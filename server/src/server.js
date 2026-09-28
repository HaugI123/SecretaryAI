import { createWorker } from 'tesseract.js';
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
// database imports
import db from "./database/database.js";
import initDatabase from "./database/init.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const upload = multer({
    storage: multer.memoryStorage()
});

app.use(cors());
app.use(express.json());

// Initialize SQLite database tables on startup
initDatabase();

app.get("/api/test", (req, res) => {
    res.json({ message: "Server is working!" });
});

// Database connection health check
app.get("/api/test-db", (req, res) => {
    const result = db.prepare("SELECT 1 AS connected").get();
    res.json({
        message: "SQLite is connected!",
        database: result.connected === 1
    });
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

    const lines =
    data.lines ??
    (data.blocks ?? [])
    .flatMap(b => b.paragraphs)
    .flatMap(p => p.lines);

    const text = lines
    .map(line =>
    line.words
    .filter(w => w.confidence >= 60)
    .map(w => w.text)
    .join(" ")
    )
    .filter(Boolean)
    .join("\n");

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
// --- USER ROUTES ---

// Create a new user
app.post("/api/users", (req, res) => {
    const { email, password_hash, full_name, role } = req.body;
    try {
        const stmt = db.prepare(`
            INSERT INTO users (email, password_hash, full_name, role)
            VALUES (?, ?, ?, ?)
        `);
        const info = stmt.run(email, password_hash, full_name, role || "preparer");
        res.status(201).json({ id: info.lastInsertRowid, email, full_name, role });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get all users
app.get("/api/users", (req, res) => {
    try {
        const users = db.prepare("SELECT id, email, full_name, role, created_at FROM users").all();
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- CLIENT ROUTES ---

// Create a new client
app.post("/api/clients", (req, res) => {
    const { first_name, last_name, email, phone, ssn_last_four, address } = req.body;
    try {
        const stmt = db.prepare(`
            INSERT INTO clients (first_name, last_name, email, phone, ssn_last_four, address)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const info = stmt.run(first_name, last_name, email, phone, ssn_last_four, address);
        res.status(201).json({ id: info.lastInsertRowid, first_name, last_name, email });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get all clients
app.get("/api/clients", (req, res) => {
    try {
        const clients = db.prepare("SELECT * FROM clients").all();
        res.json(clients);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- TAX RETURN ROUTES ---

// Create a new tax return
app.post("/api/tax-returns", (req, res) => {
    const { client_id, tax_year, status, assigned_user_id } = req.body;
    try {
        const stmt = db.prepare(`
            INSERT INTO tax_returns (client_id, tax_year, status, assigned_user_id)
            VALUES (?, ?, ?, ?)
        `);
        const info = stmt.run(
            client_id, 
            tax_year, 
            status || 'not_started', 
            assigned_user_id || null
        );
        res.status(201).json({ id: info.lastInsertRowid, client_id, tax_year, status });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get all tax returns (with linked client and assigned user info)
app.get("/api/tax-returns", (req, res) => {
    try {
        const returns = db.prepare(`
            SELECT 
                tr.id,
                tr.tax_year,
                tr.status,
                tr.created_at,
                c.id AS client_id,
                c.first_name || ' ' || c.last_name AS client_name,
                u.full_name AS assigned_to
            FROM tax_returns tr
            JOIN clients c ON tr.client_id = c.id
            LEFT JOIN users u ON tr.assigned_user_id = u.id
            ORDER BY tr.created_at DESC
        `).all();
        res.json(returns);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get tax returns for a specific client
app.get("/api/clients/:clientId/tax-returns", (req, res) => {
    const { clientId } = req.params;
    try {
        const returns = db.prepare(`
            SELECT * FROM tax_returns 
            WHERE client_id = ? 
            ORDER BY tax_year DESC
        `).all(clientId);
        res.json(returns);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update tax return status or assigned user
app.patch("/api/tax-returns/:id", (req, res) => {
    const { id } = req.params;
    const { status, assigned_user_id } = req.body;
    
    try {
        const stmt = db.prepare(`
            UPDATE tax_returns 
            SET status = COALESCE(?, status),
                assigned_user_id = COALESCE(?, assigned_user_id)
            WHERE id = ?
        `);
        const result = stmt.run(status, assigned_user_id, id);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: "Tax return not found" });
        }
        res.json({ message: "Tax return updated successfully" });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// --- DOCUMENT ROUTES ---

// Upload/Create a document record linked to a tax return
app.post("/api/tax-returns/:taxReturnId/documents", (req, res) => {
    const { taxReturnId } = req.params;
    const { document_type, file_path } = req.body;
    
    try {
        const stmt = db.prepare(`
            INSERT INTO documents (tax_return_id, document_type, file_path)
            VALUES (?, ?, ?)
        `);
        const info = stmt.run(taxReturnId, document_type, file_path);
        res.status(201).json({ 
            id: info.lastInsertRowid, 
            tax_return_id: taxReturnId, 
            document_type, 
            file_path 
        });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Get all documents for a specific tax return
app.get("/api/tax-returns/:taxReturnId/documents", (req, res) => {
    const { taxReturnId } = req.params;
    try {
        const docs = db.prepare(`
            SELECT * FROM documents 
            WHERE tax_return_id = ?
            ORDER BY uploaded_at DESC
        `).all(taxReturnId);
        res.json(docs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete a document record
app.delete("/api/documents/:id", (req, res) => {
    const { id } = req.params;
    try {
        const stmt = db.prepare("DELETE FROM documents WHERE id = ?");
        const result = stmt.run(id);
        
        if (result.changes === 0) {
            return res.status(404).json({ error: "Document not found" });
        }
        res.json({ message: "Document deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
