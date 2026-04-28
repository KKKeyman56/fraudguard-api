import os
import sqlite3

DATABASE_URL = os.getenv("DATABASE_URL")

if DATABASE_URL:
    import psycopg2
    import psycopg2.extras

    def get_db():
        conn = psycopg2.connect(DATABASE_URL)
        return conn

    def init_db():
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS api_keys (
                id            SERIAL PRIMARY KEY,
                key           TEXT UNIQUE NOT NULL,
                email         TEXT NOT NULL,
                client_name   TEXT NOT NULL,
                plan          TEXT DEFAULT 'free',
                created_at    TEXT DEFAULT (to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')),
                is_active     INTEGER DEFAULT 1,
                request_count INTEGER DEFAULT 0
            )
        """)
        cur.execute("""
            INSERT INTO api_keys (key, email, client_name, plan)
            VALUES
            ('fg_live_demo_key_001', 'demo@fraudguard.io', 'Demo Account', 'free'),
            ('fg_live_test_key_002', 'test@fraudguard.io', 'Test Account', 'pro')
            ON CONFLICT (key) DO NOTHING
        """)
        conn.commit()
        cur.close()
        conn.close()
        print("PostgreSQL database initialized.")

    def query_one(sql, params=()):
        conn = get_db()
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(sql, params)
        row = cur.fetchone()
        cur.close()
        conn.close()
        return dict(row) if row else None

    def execute(sql, params=()):
        conn = get_db()
        cur = conn.cursor()
        cur.execute(sql, params)
        conn.commit()
        cur.close()
        conn.close()

else:
    DB_PATH = "/app/data/fraudguard.db"

    def get_db():
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return conn

    def init_db():
        conn = get_db()
        conn.execute("""
            CREATE TABLE IF NOT EXISTS api_keys (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                key           TEXT UNIQUE NOT NULL,
                email         TEXT NOT NULL,
                client_name   TEXT NOT NULL,
                plan          TEXT DEFAULT 'free',
                created_at    TEXT DEFAULT (datetime('now')),
                is_active     INTEGER DEFAULT 1,
                request_count INTEGER DEFAULT 0
            )
        """)
        conn.execute("""
            INSERT OR IGNORE INTO api_keys (key, email, client_name, plan)
            VALUES
            ('fg_live_demo_key_001', 'demo@fraudguard.io', 'Demo Account', 'free'),
            ('fg_live_test_key_002', 'test@fraudguard.io', 'Test Account', 'pro')
        """)
        conn.commit()
        conn.close()
        print(f"SQLite initialized at {DB_PATH}")

    def query_one(sql, params=()):
        conn = get_db()
        row = conn.execute(sql, params).fetchone()
        conn.close()
        return dict(row) if row else None

    def execute(sql, params=()):
        conn = get_db()
        conn.execute(sql, params)
        conn.commit()
        conn.close()