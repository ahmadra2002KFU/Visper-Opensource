import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';

export interface Transcription {
  id: number;
  text: string;
  duration_seconds: number | null;
  tokens_used: number | null;
  created_at: string;
  is_favorite: number;
}

export class DatabaseService {
  private db: Database.Database;

  constructor() {
    const userDataPath = app.getPath('userData');
    const dbPath = path.join(userDataPath, 'visper.db');

    // Ensure directory exists
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }

    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initialize();
  }

  private initialize() {
    // Create transcriptions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transcriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        duration_seconds REAL,
        tokens_used INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_favorite INTEGER DEFAULT 0
      );

      CREATE INDEX IF NOT EXISTS idx_created_at ON transcriptions(created_at DESC);
    `);

    // Migration: Add missing columns to existing databases
    this.migrateSchema();

    // Create FTS table for search
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS transcriptions_fts USING fts5(
        text,
        content='transcriptions',
        content_rowid='id'
      );
    `);

    // Create triggers to keep FTS in sync
    this.db.exec(`
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
    `);
  }

  saveTranscription(text: string, durationSeconds?: number, tokensUsed?: number): number {
    const stmt = this.db.prepare(`
      INSERT INTO transcriptions (text, duration_seconds, tokens_used)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(text, durationSeconds ?? null, tokensUsed ?? null);
    return result.lastInsertRowid as number;
  }

  getTranscriptions(page: number = 1, limit: number = 20): { items: Transcription[]; total: number } {
    const offset = (page - 1) * limit;

    const countStmt = this.db.prepare('SELECT COUNT(*) as count FROM transcriptions');
    const total = (countStmt.get() as { count: number }).count;

    const stmt = this.db.prepare(`
      SELECT * FROM transcriptions
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    const items = stmt.all(limit, offset) as Transcription[];

    return { items, total };
  }

  searchTranscriptions(query: string, page: number = 1, limit: number = 20): { items: Transcription[]; total: number } {
    const offset = (page - 1) * limit;

    // Count total matches
    const countStmt = this.db.prepare(`
      SELECT COUNT(*) as count FROM transcriptions
      WHERE id IN (SELECT rowid FROM transcriptions_fts WHERE transcriptions_fts MATCH ?)
    `);
    const total = (countStmt.get(query) as { count: number }).count;

    // Get paginated results
    const stmt = this.db.prepare(`
      SELECT t.* FROM transcriptions t
      WHERE t.id IN (SELECT rowid FROM transcriptions_fts WHERE transcriptions_fts MATCH ?)
      ORDER BY t.created_at DESC
      LIMIT ? OFFSET ?
    `);
    const items = stmt.all(query, limit, offset) as Transcription[];

    return { items, total };
  }

  deleteTranscription(id: number): boolean {
    const stmt = this.db.prepare('DELETE FROM transcriptions WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  toggleFavorite(id: number): boolean {
    const stmt = this.db.prepare(`
      UPDATE transcriptions
      SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END
      WHERE id = ?
    `);
    const result = stmt.run(id);
    return result.changes > 0;
  }

  clearHistory(): void {
    this.db.exec('DELETE FROM transcriptions');
  }

  getStats(): { totalTranscriptions: number; totalDuration: number } {
    const stmt = this.db.prepare(`
      SELECT
        COUNT(*) as totalTranscriptions,
        COALESCE(SUM(duration_seconds), 0) as totalDuration
      FROM transcriptions
    `);
    return stmt.get() as { totalTranscriptions: number; totalDuration: number };
  }

  close() {
    this.db.close();
  }

  private migrateSchema() {
    // Get existing columns
    const columns = this.db.prepare("PRAGMA table_info(transcriptions)").all() as { name: string }[];
    const columnNames = columns.map(c => c.name);

    // Add missing columns
    if (!columnNames.includes('duration_seconds')) {
      this.db.exec('ALTER TABLE transcriptions ADD COLUMN duration_seconds REAL');
    }
    if (!columnNames.includes('tokens_used')) {
      this.db.exec('ALTER TABLE transcriptions ADD COLUMN tokens_used INTEGER');
    }
    if (!columnNames.includes('is_favorite')) {
      this.db.exec('ALTER TABLE transcriptions ADD COLUMN is_favorite INTEGER DEFAULT 0');
    }
  }
}
