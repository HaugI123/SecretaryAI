import {useRef, useState} from "react";

function Component({onClose}) {

    const fileInputRef = useRef(null);

    const [ocrText, setOcr] = useState("");
    const [loading, setLoading] = useState(false);

    const openCamera = () => {
        fileInputRef.current.click();
    };

    const handleImage = async(event) => {
        const file = event.target.files[0];

        if(!file) return;

        setLoading(true);
        setOcr("");

        const formData = new FormData();
        formData.append("document", file);

        try{
            const response = await fetch("http://localhost:5000/api/ocr", {
                method: "POST",
                body: formData,
            });

            const result = await response.json();

            console.log("OCR result:", result.text);
            setOcr(result.text);

        }   catch (error) {
            console.error("OCR failed:", error);
            setOcr("Failed OCR processing.")
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <button onClick={openCamera}>
                Scan Document
            </button>

            <button onclick={onClose}>
                Close
            </button>

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImage}
                style={{ display: "none"}}
            />

            {loading && (
                <p>Processing doc.</p>
            )}

            {ocrText && (
                <div>
                    <h3>Extracted Text:</h3>
                    <pre>{ocrText}</pre>
                </div>
            )}
        </div>
    );
}

export default Component;
