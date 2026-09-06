import {useEffect, useRef} from "react";
import jscanify from "jscanify/client";

function DocumentScanner({onClose}) {

    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const resultCanvasRef = useRef(null);

    const scanner = new jscanify();

    const canvasSetup = () => {
        const video = videoRef.current;

        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const resultCanvas = resultCanvasRef.current;
        resultCanvas.width = video.videoWidth;
        resultCanvas.height = video.videoHeight;
    }

    const scanFrame = () => {

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        requestAnimationFrame(scanFrame);

    }

    const documentDet = () => {
        const canvas = canvasRef.current;

        const result = scanner.highlightPaper(canvas);

        const resultCanvas = resultCanvasRef.current;
        const resultContext = resultCanvas.getContext("2d");

        resultContext.drawImage(result, 0, 0, resultCanvas.width, resultCanvas.height);
    };

    useEffect(() => {

        navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment"
            }
        }).then((stream) => {
           videoRef.current.srcObject = stream;
           videoRef.current.onloadedmetadata = () => {
               canvasSetup();
               scanFrame();
        };
    });

        return () => {
            const stream = videoRef.current?.srcObject;

            if (stream){
                stream.getTracks().forEach(track => track.stop());
            }
        };
}, []);

    useEffect(() => {
        const interval = setInterval(() => {
            documentDet();
        }, 200);

        return () => {
            clearInterval(interval);
        };
    }, []);

    return(

            <div>
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                />
                <button onClick={onClose}> Detect Document </button>
                <canvas ref={canvasRef}/>
                <canvas
                    ref={resultCanvasRef}
                    style={{ border: "2px solid red" }}
                />
            </div>
    );
}


export default DocumentScanner;
