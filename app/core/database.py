"""
Simple SQLite database for API key management.
MVP: SQLite (no setup needed).
Production: swap to PostgreSQL via DATABASE_URL env var.
"""
import sqlite3
import os
from pathlib import Path

DB_PATH = os.getenv("DB_PATH", "fraudguard.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS api_keys (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            key         TEXT UNIQUE NOT NULL,
            email       TEXT NOT NULL,
            client_name TEXT NOT NULL,
            plan        TEXT DEFAULT 'free',
            created_at  TEXT DEFAULT (datetime('now')),
            is_active   INTEGER DEFAULT 1,
            request_count INTEGER DEFAULT 0
        )
    """)
    # Seed demo keys
    conn.execute("""
        INSERT OR IGNORE INTO api_keys (key, email, client_name, plan)
        VALUES 
        ('fg_live_demo_key_001', 'demo@fraudguard.io', 'Demo Account', 'free'),
        ('fg_live_test_key_002', 'test@fraudguard.io', 'Test Account', 'pro')
    """)
    conn.commit()
    conn.close()
    print("Database initialized.")
