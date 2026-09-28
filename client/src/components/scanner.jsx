import { useCallback, useEffect, useRef, useState } from "react";
import cvModule from "@techstark/opencv-js";


const OCR_URL = "http://localhost:5000/api/ocr";

// Live detection
const DETECT_WIDTH = 960;
const DETECT_INTERVAL_MS = 100; // ~10 checks per second is plenty
const CANNY_LOW = 50;
const CANNY_HIGH = 150;
const MIN_CONTOUR_RATIO = 0.1; // quick reject before doing hull/approx
const MIN_QUAD_RATIO = 0.15; // document must cover at least 15% of frame
const MAX_MISSES = 5; // frames without a hit before the outline disappears
const STEADY_FRAMES = 6; // consecutive stable frames = "hold steady" done
const STEADY_MOVE_RATIO = 0.008; // max corner drift per frame (fraction of width)

// Capture
const BURST_FRAMES = 6; // grab this many frames, keep the sharpest
const BLUR_WARN_SCORE = 40; // Laplacian variance; raise if blurry shots slip through

// Warp + OCR preprocessing
const MAX_WARP_SIDE = 4000;
const EDGE_TRIM = 0.012; // trim 1.2% off each side to drop page edge / table
const TARGET_SHORT_SIDE = 2000; // ~200-250 DPI for a letter/A4 page
const BG_KERNEL = 15; // at 1/4 scale; must be bigger than the thickest text stroke
const OCR_PAD = 30; // white border, Tesseract does better with margin


const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function distance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
}

// Returns [topLeft, topRight, bottomRight, bottomLeft]
function orderCorners(points) {
    const topLeft = points.reduce((b, p) => (p.x + p.y < b.x + b.y ? p : b));
    const bottomRight = points.reduce((b, p) => (p.x + p.y > b.x + b.y ? p : b));
    const topRight = points.reduce((b, p) => (p.x - p.y > b.x - b.y ? p : b));
    const bottomLeft = points.reduce((b, p) => (p.x - p.y < b.x - b.y ? p : b));
    return [topLeft, topRight, bottomRight, bottomLeft];
}

function defaultCorners(w, h) {
    const mx = w * 0.05;
    const my = h * 0.05;
    return [
        { x: mx, y: my },
        { x: w - mx, y: my },
        { x: w - mx, y: h - my },
        { x: mx, y: h - my }
    ];
}

const nextFrame = (video) =>
new Promise((resolve) => {
    if (video.requestVideoFrameCallback) {
        video.requestVideoFrameCallback(() => resolve());
    } else {
        setTimeout(resolve, 60);
    }
});

// Ask the camera for continuous focus/exposure/white balance where supported.
async function tuneTrack(stream) {
    try {
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        const advanced = [];

        if (caps.focusMode?.includes("continuous")) {
            advanced.push({ focusMode: "continuous" });
        }
        if (caps.exposureMode?.includes("continuous")) {
            advanced.push({ exposureMode: "continuous" });
        }
        if (caps.whiteBalanceMode?.includes("continuous")) {
            advanced.push({ whiteBalanceMode: "continuous" });
        }

        if (advanced.length) {
            await track.applyConstraints({ advanced });
        }
    } catch (err) {
        console.warn("Could not tune camera:", err);
    }
}


// Returns ordered corners [TL, TR, BR, BL] in canvas pixels, or null.
function findDocumentCorners(cv, canvas) {
    let src = null;
    let gray = null;
    let blurred = null;
    let edges = null;
    let kernel = null;
    let contours = null;
    let hierarchy = null;

    try {
        src = cv.imread(canvas);
        gray = new cv.Mat();
        blurred = new cv.Mat();
        edges = new cv.Mat();

        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
        cv.Canny(blurred, edges, CANNY_LOW, CANNY_HIGH);

        // Close small gaps in the page outline so it forms one contour
        kernel = cv.Mat.ones(3, 3, cv.CV_8U);
        cv.dilate(edges, edges, kernel, new cv.Point(-1, -1), 2);

        contours = new cv.MatVector();
        hierarchy = new cv.Mat();
        cv.findContours(
            edges,
            contours,
            hierarchy,
            cv.RETR_LIST,
            cv.CHAIN_APPROX_SIMPLE
        );

        const imageArea = canvas.width * canvas.height;
        let bestPoints = null;
        let bestArea = 0;

        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = cv.contourArea(contour);

            if (area < imageArea * MIN_CONTOUR_RATIO) {
                contour.delete();
                continue;
            }

            // Work on the convex hull so a slightly ragged outline
            // (curled corner, thumb, shadow) still reduces to 4 points.
            const hull = new cv.Mat();
            const approx = new cv.Mat();
            cv.convexHull(contour, hull, false, true);
            const perimeter = cv.arcLength(hull, true);

            let isQuad = false;
            for (const eps of [0.02, 0.03, 0.04]) {
                cv.approxPolyDP(hull, approx, eps * perimeter, true);
                if (approx.rows === 4) {
                    isQuad = true;
                    break;
                }
            }

            if (isQuad) {
                const quadArea = cv.contourArea(approx);
                if (quadArea > bestArea && quadArea >= imageArea * MIN_QUAD_RATIO) {
                    bestArea = quadArea;
                    bestPoints = [];
                    for (let j = 0; j < 4; j++) {
                        bestPoints.push({
                            x: approx.data32S[j * 2],
                            y: approx.data32S[j * 2 + 1]
                        });
                    }
                }
            }

            approx.delete();
            hull.delete();
            contour.delete();
        }

        return bestPoints ? orderCorners(bestPoints) : null;
    } finally {
        [src, gray, blurred, edges, kernel, contours, hierarchy].forEach((m) => {
            if (m) m.delete();
        });
    }
}

// Variance of the Laplacian: higher = sharper.
function sharpnessScore(cv, canvas) {
    let src = null;
    let gray = null;
    let lap = null;
    let mean = null;
    let std = null;

    try {
        src = cv.imread(canvas);
        gray = new cv.Mat();
        lap = new cv.Mat();
        mean = new cv.Mat();
        std = new cv.Mat();

        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.Laplacian(gray, lap, cv.CV_64F);
        cv.meanStdDev(lap, mean, std);

        const s = std.data64F[0];
        return s * s;
    } finally {
        [src, gray, lap, mean, std].forEach((m) => {
            if (m) m.delete();
        });
    }
}


// Caller must delete() the returned Mat.
function warpDocument(cv, src, corners) {
    const [tl, tr, br, bl] = corners;

    let width = Math.max(distance(tl, tr), distance(bl, br));
    let height = Math.max(distance(tl, bl), distance(tr, br));

    // Cap with ONE scale factor so the aspect ratio is preserved
    const cap = Math.min(1, MAX_WARP_SIDE / Math.max(width, height));
    width = Math.max(1, Math.round(width * cap));
    height = Math.max(1, Math.round(height * cap));

    let srcPoints = null;
    let dstPoints = null;
    let transform = null;

    try {
        srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
            tl.x, tl.y,
            tr.x, tr.y,
            br.x, br.y,
            bl.x, bl.y
        ]);
        dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
            0, 0,
            width, 0,
            width, height,
            0, height
        ]);

        transform = cv.getPerspectiveTransform(srcPoints, dstPoints);

        const warped = new cv.Mat();
        cv.warpPerspective(
            src,
            warped,
            transform,
            new cv.Size(width, height),
                           cv.INTER_CUBIC,
                           cv.BORDER_REPLICATE
        );
        return warped;
    } finally {
        [srcPoints, dstPoints, transform].forEach((m) => {
            if (m) m.delete();
        });
    }
}

// Takes the warped RGBA page, returns a single-channel Mat cleaned up for
// Tesseract. Caller must delete() the returned Mat.
function preprocessForOCR(cv, warped, binarize) {
    const temps = [];
    const track = (m) => {
        temps.push(m);
        return m;
    };

    try {
        // 1. Trim the outer edge (page border, table, shadow line all
        //    turn into junk characters otherwise)
        const trimX = Math.round(warped.cols * EDGE_TRIM);
        const trimY = Math.round(warped.rows * EDGE_TRIM);
        const cropped = track(
            warped.roi(
                new cv.Rect(
                    trimX,
                    trimY,
                    warped.cols - trimX * 2,
                    warped.rows - trimY * 2
                )
            )
        );

        // 2. Grayscale
        const gray = track(new cv.Mat());
        cv.cvtColor(cropped, gray, cv.COLOR_RGBA2GRAY);

        // 3. Normalize resolution so text is a consistent size
        let sized = gray;
        const shortSide = Math.min(gray.cols, gray.rows);
        const scale = clamp(TARGET_SHORT_SIDE / shortSide, 0.5, 3);

        if (Math.abs(scale - 1) > 0.05) {
            sized = track(new cv.Mat());
            cv.resize(
                gray,
                sized,
                new cv.Size(0, 0),
                      scale,
                      scale,
                      scale > 1 ? cv.INTER_CUBIC : cv.INTER_AREA
            );
        }

        // 4. Flatten lighting: estimate the paper "background" by closing
        //    away the text (done at 1/4 size for speed), then divide it out.
        //    This removes shadows and gradients that cause phantom characters.
        const small = track(new cv.Mat());
        cv.resize(sized, small, new cv.Size(0, 0), 0.25, 0.25, cv.INTER_AREA);

        const kernel = track(
            cv.getStructuringElement(
                cv.MORPH_ELLIPSE,
                new cv.Size(BG_KERNEL, BG_KERNEL)
            )
        );
        const bgSmall = track(new cv.Mat());
        cv.morphologyEx(small, bgSmall, cv.MORPH_CLOSE, kernel);
        cv.GaussianBlur(bgSmall, bgSmall, new cv.Size(7, 7), 0);

        const bg = track(new cv.Mat());
        cv.resize(
            bgSmall,
            bg,
            new cv.Size(sized.cols, sized.rows),
                  0,
                  0,
                  cv.INTER_LINEAR
        );

        const flat = track(new cv.Mat());
        cv.divide(sized, bg, flat, 255, cv.CV_8U);

        // 5. Light denoise (median keeps text edges crisp)
        const denoised = track(new cv.Mat());
        cv.medianBlur(flat, denoised, 3);

        // 6. Optional hard black/white. Lighting is flat now, so a global
        //    Otsu threshold is clean and avoids adaptive-threshold speckle.
        let out = denoised;
        if (binarize) {
            out = track(new cv.Mat());
            cv.threshold(
                denoised,
                out,
                0,
                255,
                cv.THRESH_BINARY | cv.THRESH_OTSU
            );
        }

        // 7. White margin around the page
        const padded = new cv.Mat();
        cv.copyMakeBorder(
            out,
            padded,
            OCR_PAD,
            OCR_PAD,
            OCR_PAD,
            OCR_PAD,
            cv.BORDER_CONSTANT,
            new cv.Scalar(255, 255, 255, 255)
        );
        return padded;
    } finally {
        temps.forEach((m) => {
            try {
                m.delete();
            } catch {
                /* already deleted */
            }
        });
    }
}


function DocumentScanner({ onClose, onResult }) {
    const videoRef = useRef(null);
    const detectionCanvasRef = useRef(null);
    const captureCanvasRef = useRef(null);
    const svgRef = useRef(null);

    const streamRef = useRef(null);
    const animationRef = useRef(null);
    const cvRef = useRef(null);

    const liveCornersRef = useRef(null);
    const stableRef = useRef(0);
    const missesRef = useRef(0);
    const capturingRef = useRef(false);
    const dragRef = useRef(-1);
    const previewUrlRef = useRef(null);

    const [phase, setPhase] = useState("live"); // live | adjust | result
    const [cvReady, setCvReady] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);
    const [videoSize, setVideoSize] = useState({ w: 0, h: 0 });
    const [liveCorners, setLiveCorners] = useState(null);
    const [steady, setSteady] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState("");

    const [sharpness, setSharpness] = useState(null);
    const [adjustImage, setAdjustImage] = useState(null); // { url, w, h }
    const [corners, setCorners] = useState(null);
    const [binarize, setBinarize] = useState(false);

    const [previewUrl, setPreviewUrl] = useState(null);
    const [ocrText, setOcrText] = useState("");

    /* ---------- load OpenCV ---------- */

    useEffect(() => {
        let cancelled = false;

        const loadOpenCV = async () => {
            try {
                let cv;

                if (cvModule instanceof Promise) {
                    cv = await cvModule;
                } else if (cvModule.Mat) {
                    cv = cvModule;
                } else {
                    cv = await new Promise((resolve) => {
                        cvModule.onRuntimeInitialized = () => resolve(cvModule);
                    });
                }

                if (!cancelled) {
                    cvRef.current = cv;
                    setCvReady(true);
                }
            } catch (err) {
                console.error("OpenCV failed to load:", err);
                setError("OpenCV failed to load.");
            }
        };

        loadOpenCV();

        return () => {
            cancelled = true;
        };
    }, []);

    /* ---------- camera (only runs while in the live phase) ---------- */

    useEffect(() => {
        if (phase !== "live") return;

        let cancelled = false;
        setCameraReady(false);
        setLiveCorners(null);
        setSteady(false);
        liveCornersRef.current = null;
        stableRef.current = 0;
        missesRef.current = 0;

        const startCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: "environment" },
                        width: { ideal: 3840 },
                        height: { ideal: 2160 },
                        frameRate: { ideal: 30 }
                    },
                    audio: false
                });

                if (cancelled) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }

                streamRef.current = stream;
                tuneTrack(stream);

                const video = videoRef.current;
                if (!video) return;

                video.srcObject = stream;

                video.onloadedmetadata = async () => {
                    try {
                        await video.play();
                    } catch (err) {
                        console.warn("Video play failed:", err);
                    }
                    if (cancelled) return;

                    console.log(
                        "Camera resolution:",
                        video.videoWidth,
                        "x",
                        video.videoHeight
                    );

                    const detectionCanvas = detectionCanvasRef.current;
                    const scale = DETECT_WIDTH / video.videoWidth;
                    detectionCanvas.width = DETECT_WIDTH;
                    detectionCanvas.height = Math.round(video.videoHeight * scale);

                    const captureCanvas = captureCanvasRef.current;
                    captureCanvas.width = video.videoWidth;
                    captureCanvas.height = video.videoHeight;

                    setVideoSize({ w: video.videoWidth, h: video.videoHeight });
                    setCameraReady(true);
                };
            } catch (err) {
                console.error("Camera error:", err);
                setError(
                    "Could not access the camera. Make sure camera permission is enabled."
                );
            }
        };

        startCamera();

        return () => {
            cancelled = true;

            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
                streamRef.current = null;
            }
        };
    }, [phase]);

    /* ---------- live detection loop ---------- */

    const runDetection = useCallback(() => {
        const cv = cvRef.current;
        const video = videoRef.current;
        const canvas = detectionCanvasRef.current;

        if (!cv || !video || !canvas) return;
        if (video.readyState < 2 || video.videoWidth === 0) return;

        canvas
        .getContext("2d", { willReadFrequently: true })
        .drawImage(video, 0, 0, canvas.width, canvas.height);

        let found = null;
        try {
            found = findDocumentCorners(cv, canvas);
        } catch (err) {
            console.error("Document detection error:", err);
        }

        if (found) {
            const scale = video.videoWidth / canvas.width;
            const scaled = found.map((p) => ({ x: p.x * scale, y: p.y * scale }));
            const prev = liveCornersRef.current;
            let next = scaled;

            missesRef.current = 0;

            if (prev) {
                const move = Math.max(
                    ...scaled.map((p, i) => distance(p, prev[i]))
                );

                stableRef.current =
                move < video.videoWidth * STEADY_MOVE_RATIO
                ? stableRef.current + 1
                : 0;

                // Smooth small jitter, snap on big moves
                const a = move > video.videoWidth * 0.05 ? 1 : 0.5;
                next = scaled.map((p, i) => ({
                    x: prev[i].x * (1 - a) + p.x * a,
                                             y: prev[i].y * (1 - a) + p.y * a
                }));
            } else {
                stableRef.current = 0;
            }

            liveCornersRef.current = next;
            setLiveCorners(next);
            setSteady(stableRef.current >= STEADY_FRAMES);
        } else {
            missesRef.current += 1;

            // Hold the last outline briefly so it doesn't flicker
            if (missesRef.current > MAX_MISSES) {
                liveCornersRef.current = null;
                stableRef.current = 0;
                setLiveCorners(null);
                setSteady(false);
            }
        }
    }, []);

    useEffect(() => {
        if (phase !== "live" || !cvReady || !cameraReady) return;

        let stopped = false;
        let last = 0;

        const tick = (now) => {
            if (stopped) return;
            animationRef.current = requestAnimationFrame(tick);

            if (capturingRef.current) return;
            if (now - last < DETECT_INTERVAL_MS) return;

            last = now;
            runDetection();
        };

        animationRef.current = requestAnimationFrame(tick);

        return () => {
            stopped = true;
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [phase, cvReady, cameraReady, runDetection]);

    /* ---------- capture: burst, keep the sharpest frame ---------- */

    const grabSharpestFrame = async () => {
        const cv = cvRef.current;
        const video = videoRef.current;
        const small = detectionCanvasRef.current;
        const full = captureCanvasRef.current;

        const smallCtx = small.getContext("2d", { willReadFrequently: true });
        const fullCtx = full.getContext("2d");

        let best = -1;

        for (let i = 0; i < BURST_FRAMES; i++) {
            smallCtx.drawImage(video, 0, 0, small.width, small.height);
            const score = sharpnessScore(cv, small);

            if (score > best) {
                best = score;
                fullCtx.drawImage(video, 0, 0, full.width, full.height);
            }

            await nextFrame(video);
        }

        return best;
    };

    const captureDocument = async () => {
        const cv = cvRef.current;
        const small = detectionCanvasRef.current;
        const full = captureCanvasRef.current;

        if (!cv || !videoRef.current || !small || !full) return;

        setProcessing(true);
        setError("");
        capturingRef.current = true;

        try {
            const score = await grabSharpestFrame();
            setSharpness(score);

            // Re-detect on the frame we actually kept
            small
            .getContext("2d", { willReadFrequently: true })
            .drawImage(full, 0, 0, small.width, small.height);

            const scale = full.width / small.width;
            const found = findDocumentCorners(cv, small);

            const initial = found
            ? found.map((p) => ({ x: p.x * scale, y: p.y * scale }))
            : liveCornersRef.current || defaultCorners(full.width, full.height);

            // Downscaled preview for the crop editor
            const previewWidth = Math.min(1280, full.width);
            const previewHeight = Math.round(
                (full.height * previewWidth) / full.width
            );
            const temp = document.createElement("canvas");
            temp.width = previewWidth;
            temp.height = previewHeight;
            temp.getContext("2d").drawImage(full, 0, 0, previewWidth, previewHeight);

            setAdjustImage({
                url: temp.toDataURL("image/jpeg", 0.85),
                           w: full.width,
                           h: full.height
            });
            setCorners(initial);
            setPhase("adjust");
        } catch (err) {
            console.error("Capture failed:", err);
            setError("Failed to capture the document.");
        } finally {
            capturingRef.current = false;
            setProcessing(false);
        }
    };

    /* ---------- crop editor (drag the corners) ---------- */

    const handlePointerMove = (e) => {
        const index = dragRef.current;
        if (index < 0 || !svgRef.current || !adjustImage) return;

        const rect = svgRef.current.getBoundingClientRect();
        const x = clamp(((e.clientX - rect.left) / rect.width) * adjustImage.w, 0, adjustImage.w);
        const y = clamp(((e.clientY - rect.top) / rect.height) * adjustImage.h, 0, adjustImage.h);

        setCorners((prev) => prev.map((p, i) => (i === index ? { x, y } : p)));
    };

    const endDrag = () => {
        dragRef.current = -1;
    };

    /* ---------- process + OCR ---------- */

    const uploadBlob = async (blob) => {
        const formData = new FormData();
        formData.append("document", blob, "scanned-document.png");

        const response = await fetch(OCR_URL, {
            method: "POST",
            body: formData
        });

        if (!response.ok) {
            throw new Error(`OCR request failed (${response.status}).`);
        }

        const result = await response.json();
        return result.text || "";
    };

    const processAndRead = async () => {
        const cv = cvRef.current;
        const captureCanvas = captureCanvasRef.current;

        if (!cv || !captureCanvas || !corners) return;

        setProcessing(true);
        setError("");

        let src = null;
        let warped = null;
        let processed = null;

        try {
            src = cv.imread(captureCanvas);
            warped = warpDocument(cv, src, corners);
            processed = preprocessForOCR(cv, warped, binarize);

            const outCanvas = document.createElement("canvas");
            cv.imshow(outCanvas, processed);

            const blob = await new Promise((resolve) =>
            outCanvas.toBlob(resolve, "image/png")
            );
            if (!blob) throw new Error("Could not create image.");

            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
            }
            const url = URL.createObjectURL(blob);
            previewUrlRef.current = url;
            setPreviewUrl(url);

            const text = await uploadBlob(blob);
            setOcrText(text);
            setPhase("result");
        } catch (err) {
            console.error("Processing failed:", err);
            setError(err.message || "Failed to process the document.");
        } finally {
            [src, warped, processed].forEach((m) => {
                if (m) m.delete();
            });
                setProcessing(false);
        }
    };

    useEffect(() => {
        return () => {
            if (previewUrlRef.current) {
                URL.revokeObjectURL(previewUrlRef.current);
            }
        };
    }, []);

    const finish = () => {
        if (onResult) onResult(ocrText);
        onClose();
    };

    /* ---------- render ---------- */

    const handleRadius = adjustImage ? adjustImage.w * 0.03 : 0;
    const blurry = sharpness !== null && sharpness < BLUR_WARN_SCORE;

    return (
        <div className="scanner">
        {phase === "live" && (
            <>
            <div className="scanner-camera" style={{ position: "relative" }}>
            <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ width: "100%", display: "block" }}
            />

            {liveCorners && videoSize.w > 0 && (
                <svg
                viewBox={`0 0 ${videoSize.w} ${videoSize.h}`}
                style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none"
                }}
                >
                <polygon
                points={liveCorners.map((p) => `${p.x},${p.y}`).join(" ")}
                fill={steady ? "rgba(0,255,102,0.12)" : "rgba(255,190,0,0.10)"}
                stroke={steady ? "#00ff66" : "#ffbe00"}
                strokeWidth="4"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                />
                </svg>
            )}
            </div>

            {!cvReady && <p>Loading OpenCV...</p>}
            {cvReady && !cameraReady && !error && <p>Starting camera...</p>}
            {cameraReady && !liveCorners && (
                <p>Move the camera over the document.</p>
            )}
            {liveCorners && !steady && <p>Hold steady...</p>}
            {liveCorners && steady && <p>Document detected. Ready to capture.</p>}

            {error && <p className="field-error">{error}</p>}

            <div className="scanner-buttons">
            <button
            className="button button-primary"
            onClick={captureDocument}
            disabled={!cvReady || !cameraReady || processing}
            >
            {processing ? "Capturing..." : "Take picture"}
            </button>

            <button
            className="button button-quiet"
            onClick={onClose}
            disabled={processing}
            >
            Cancel
            </button>
            </div>
            </>
        )}

        {phase === "adjust" && adjustImage && corners && (
            <>
            <p>Drag the corners so they sit on the corners of the page.</p>

            <svg
            ref={svgRef}
            viewBox={`0 0 ${adjustImage.w} ${adjustImage.h}`}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            style={{
                width: "100%",
                display: "block",
                touchAction: "none",
                userSelect: "none"
            }}
            >
            <image
            href={adjustImage.url}
            width={adjustImage.w}
            height={adjustImage.h}
            />

            <polygon
            points={corners.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="rgba(0,255,102,0.10)"
            stroke="#00ff66"
            strokeWidth="3"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            />

            {corners.map((p, i) => (
                <g key={i}>
                <circle
                cx={p.x}
                cy={p.y}
                r={handleRadius * 0.45}
                fill="#00ff66"
                stroke="#003d19"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
                />
                {/* Large invisible hit area for fingers */}
                <circle
                cx={p.x}
                cy={p.y}
                r={handleRadius}
                fill="transparent"
                style={{ cursor: "grab" }}
                onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    dragRef.current = i;
                }}
                />
                </g>
            ))}
            </svg>

            {blurry && (
                <p className="field-error">
                This photo looks blurry. Retaking it will give better text.
                </p>
            )}

            <label style={{ display: "block", margin: "8px 0" }}>
            <input
            type="checkbox"
            checked={binarize}
            onChange={(e) => setBinarize(e.target.checked)}
            />{" "}
            Black and white (crisper text, may drop faint print)
            </label>

            {error && <p className="field-error">{error}</p>}

            <div className="scanner-buttons">
            <button
            className="button button-primary"
            onClick={processAndRead}
            disabled={processing}
            >
            {processing ? "Reading..." : "Read document"}
            </button>

            <button
            className="button button-quiet"
            onClick={() => setPhase("live")}
            disabled={processing}
            >
            Retake
            </button>

            <button
            className="button button-quiet"
            onClick={onClose}
            disabled={processing}
            >
            Cancel
            </button>
            </div>
            </>
        )}

        {phase === "result" && (
            <>
            {previewUrl && (
                <img
                src={previewUrl}
                alt="Processed document sent to OCR"
                style={{ maxWidth: "100%", display: "block", marginBottom: 12 }}
                />
            )}

            <textarea
            value={ocrText}
            onChange={(e) => setOcrText(e.target.value)}
            rows={12}
            style={{ width: "100%", boxSizing: "border-box" }}
            />

            {error && <p className="field-error">{error}</p>}

            <div className="scanner-buttons">
            <button className="button button-primary" onClick={finish}>
            Use text
            </button>

            <button
            className="button button-quiet"
            onClick={() => setPhase("adjust")}
            >
            Adjust and re-read
            </button>

            <button
            className="button button-quiet"
            onClick={() => setPhase("live")}
            >
            Retake
            </button>
            </div>
            </>
        )}

        {/* Always mounted, never shown */}
        <canvas ref={detectionCanvasRef} style={{ display: "none" }} />
        <canvas ref={captureCanvasRef} style={{ display: "none" }} />
        </div>
    );
}

export default DocumentScanner;
