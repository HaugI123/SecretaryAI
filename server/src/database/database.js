import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create or connect to secretary.db inside the database folder
const db = new Database(path.join(__dirname, "secretary.db"));

// Enable foreign key support
db.pragma("foreign_keys = ON");

export default db;