import { createWorker } from 'tesseract.js';
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const upload = multer({
    storage: multer.memoryStorage()
});

app.use(cors());
app.use(express.json());

app.get("/api/test", (req, res) => {
    res.json({ message: "Server is working!" });
});

app.post("/api/ocr", upload.single("document"), async (req, res) => {

    try {
        if (!req.file) {
            return res.status(400).json({
                error: "No document uploaded"
            });
        }

    console.log("Received:", req.file.originalname);
    console.log("Size:", req.file.size);

    const worker = await createWorker("eng");

    const {data} = await worker.recognize(req.file.buffer);

    await worker.terminate();

    res.json({
        text: data.text
    });

    }catch (error) {
        console.error(error);
        res.status(500).json({
            error: "OCR processing error"
        });
    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
