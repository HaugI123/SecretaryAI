import db from "./database.js";

export default function initDatabase() {
  db.exec(`
    -- 1. USERS TABLE
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'preparer', 'viewer')) DEFAULT 'preparer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. CLIENTS TABLE
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE,
      phone TEXT,
      ssn_last_four TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 3. TAX RETURNS TABLE
    CREATE TABLE IF NOT EXISTS tax_returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      tax_year INTEGER NOT NULL,
      status TEXT CHECK(status IN ('not_started', 'in_progress', 'review', 'filed', 'completed')) DEFAULT 'not_started',
      assigned_user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    -- 4. DOCUMENTS TABLE
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tax_return_id INTEGER NOT NULL,
      document_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (tax_return_id) REFERENCES tax_returns(id) ON DELETE CASCADE
    );
  `);

  console.log("Database tables initialized successfully!");
}