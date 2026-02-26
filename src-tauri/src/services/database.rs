use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use anyhow::Result;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transcription {
    pub id: i64,
    pub text: String,
    #[serde(rename = "durationSeconds")]
    pub duration_seconds: Option<f64>,
    #[serde(rename = "tokensUsed")]
    pub tokens_used: Option<i64>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "isFavorite")]
    pub is_favorite: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryResult {
    pub items: Vec<Transcription>,
    pub total: i64,
}

pub struct DatabaseService {
    conn: Connection,
}

impl DatabaseService {
    pub fn new() -> Result<Self> {
        let db_path = Self::get_db_path()?;

        // Ensure directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let conn = Connection::open(&db_path)?;

        // Enable WAL mode for better concurrency
        conn.execute_batch("PRAGMA journal_mode = WAL;")?;

        let mut service = Self { conn };
        service.initialize()?;

        Ok(service)
    }

    fn get_db_path() -> Result<PathBuf> {
        let data_dir = dirs::data_local_dir()
            .ok_or_else(|| anyhow::anyhow!("Could not find data directory"))?;
        Ok(data_dir.join("Visper").join("visper.db"))
    }

    fn initialize(&mut self) -> Result<()> {
        // Create main transcriptions table
        self.conn.execute_batch(r#"
            CREATE TABLE IF NOT EXISTS transcriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                text TEXT NOT NULL,
                duration_seconds REAL,
                tokens_used INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_favorite INTEGER DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_created_at ON transcriptions(created_at DESC);
        "#)?;

        // Run migrations for existing databases
        self.migrate_schema()?;

        // Create FTS5 virtual table for full-text search
        self.conn.execute_batch(r#"
            CREATE VIRTUAL TABLE IF NOT EXISTS transcriptions_fts USING fts5(
                text,
                content='transcriptions',
                content_rowid='id'
            );
        "#)?;

        // Create triggers to keep FTS in sync
        self.conn.execute_batch(r#"
            CREATE TRIGGER IF NOT EXISTS transcriptions_ai AFTER INSERT ON transcriptions BEGIN
                INSERT INTO transcriptions_fts(rowid, text) VALUES (new.id, new.text);
            END;

            CREATE TRIGGER IF NOT EXISTS transcriptions_ad AFTER DELETE ON transcriptions BEGIN
                INSERT INTO transcriptions_fts(transcriptions_fts, rowid, text) VALUES('delete', old.id, old.text);
            END;

            CREATE TRIGGER IF NOT EXISTS transcriptions_au AFTER UPDATE ON transcriptions BEGIN
                INSERT INTO transcriptions_fts(transcriptions_fts, rowid, text) VALUES('delete', old.id, old.text);
                INSERT INTO transcriptions_fts(rowid, text) VALUES (new.id, new.text);
            END;
        "#)?;

        Ok(())
    }

    fn migrate_schema(&mut self) -> Result<()> {
        // Check existing columns
        let mut stmt = self.conn.prepare("PRAGMA table_info(transcriptions)")?;
        let columns: Vec<String> = stmt.query_map([], |row| row.get(1))?
            .filter_map(|r| r.ok())
            .collect();

        // Add missing columns
        if !columns.contains(&"duration_seconds".to_string()) {
            self.conn.execute("ALTER TABLE transcriptions ADD COLUMN duration_seconds REAL", [])?;
        }
        if !columns.contains(&"tokens_used".to_string()) {
            self.conn.execute("ALTER TABLE transcriptions ADD COLUMN tokens_used INTEGER", [])?;
        }
        if !columns.contains(&"is_favorite".to_string()) {
            self.conn.execute("ALTER TABLE transcriptions ADD COLUMN is_favorite INTEGER DEFAULT 0", [])?;
        }

        Ok(())
    }

    pub fn save_transcription(&self, text: &str, duration_seconds: f64) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO transcriptions (text, duration_seconds) VALUES (?1, ?2)",
            params![text, duration_seconds],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn get_transcriptions(&self, page: u32, limit: u32) -> Result<HistoryResult> {
        let offset = (page.saturating_sub(1)) * limit;

        let total: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM transcriptions",
            [],
            |row| row.get(0),
        )?;

        let mut stmt = self.conn.prepare(
            "SELECT id, text, duration_seconds, tokens_used, created_at, is_favorite
             FROM transcriptions ORDER BY created_at DESC LIMIT ?1 OFFSET ?2"
        )?;

        let items = stmt.query_map(params![limit, offset], |row| {
            Ok(Transcription {
                id: row.get(0)?,
                text: row.get(1)?,
                duration_seconds: row.get(2)?,
                tokens_used: row.get(3)?,
                created_at: row.get(4)?,
                is_favorite: row.get(5)?,
            })
        })?.filter_map(|r| r.ok()).collect();

        Ok(HistoryResult { items, total })
    }

    pub fn search_transcriptions(&self, query: &str, page: u32, limit: u32) -> Result<HistoryResult> {
        let offset = (page.saturating_sub(1)) * limit;

        // Escape special FTS5 characters and add wildcards for prefix matching
        let search_query = format!("\"{}\"*", query.replace('"', "\"\""));

        let total: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM transcriptions WHERE id IN (SELECT rowid FROM transcriptions_fts WHERE transcriptions_fts MATCH ?1)",
            params![search_query],
            |row| row.get(0),
        )?;

        let mut stmt = self.conn.prepare(
            "SELECT t.id, t.text, t.duration_seconds, t.tokens_used, t.created_at, t.is_favorite
             FROM transcriptions t
             WHERE t.id IN (SELECT rowid FROM transcriptions_fts WHERE transcriptions_fts MATCH ?1)
             ORDER BY t.created_at DESC LIMIT ?2 OFFSET ?3"
        )?;

        let items = stmt.query_map(params![search_query, limit, offset], |row| {
            Ok(Transcription {
                id: row.get(0)?,
                text: row.get(1)?,
                duration_seconds: row.get(2)?,
                tokens_used: row.get(3)?,
                created_at: row.get(4)?,
                is_favorite: row.get(5)?,
            })
        })?.filter_map(|r| r.ok()).collect();

        Ok(HistoryResult { items, total })
    }

    pub fn delete_transcription(&self, id: i64) -> Result<bool> {
        let changes = self.conn.execute("DELETE FROM transcriptions WHERE id = ?1", params![id])?;
        Ok(changes > 0)
    }

    pub fn clear_history(&self) -> Result<()> {
        self.conn.execute("DELETE FROM transcriptions", [])?;
        self.conn.execute("INSERT INTO transcriptions_fts(transcriptions_fts) VALUES('rebuild')", [])?;
        Ok(())
    }

    pub fn toggle_favorite(&self, id: i64) -> Result<bool> {
        self.conn.execute(
            "UPDATE transcriptions SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END WHERE id = ?1",
            params![id],
        )?;

        let is_favorite: i32 = self.conn.query_row(
            "SELECT is_favorite FROM transcriptions WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )?;

        Ok(is_favorite == 1)
    }
}
