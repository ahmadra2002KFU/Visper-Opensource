# Database Schema Documentation

**Last Updated**: 2026-01-08
**Source File**: `src/main/services/database.service.ts`

---

## Table of Contents

1. [Overview](#overview)
2. [Database Location](#database-location)
3. [Tables](#tables)
4. [Full-Text Search](#full-text-search)
5. [Triggers](#triggers)
6. [Schema Migrations](#schema-migrations)
7. [Query Examples](#query-examples)

---

## Overview

Visper uses SQLite with the `better-sqlite3` package for local data persistence. The database stores transcription history and supports full-text search via FTS5.

**Configuration:**
- Engine: SQLite 3 (via better-sqlite3)
- Journal Mode: WAL (Write-Ahead Logging)
- Synchronous writes for data integrity

---

## Database Location

The database file is stored in the Electron user data directory:

| Platform | Path |
|----------|------|
| Windows | `%APPDATA%\visper\visper.db` |

**Initialization Code:**
```typescript
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'visper.db');
this.db = new Database(dbPath);
this.db.pragma('journal_mode = WAL');
```

---

## Tables

### transcriptions

The main table storing all transcription records.

```sql
CREATE TABLE IF NOT EXISTS transcriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  duration_seconds REAL,
  tokens_used INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_favorite INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_created_at ON transcriptions(created_at DESC);
```

**Column Details:**

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | INTEGER | No | AUTO | Primary key |
| `text` | TEXT | No | - | Transcription content |
| `duration_seconds` | REAL | Yes | NULL | Recording duration in seconds |
| `tokens_used` | INTEGER | Yes | NULL | API tokens consumed (not currently used) |
| `created_at` | DATETIME | No | CURRENT_TIMESTAMP | Record creation time |
| `is_favorite` | INTEGER | Yes | 0 | Favorite flag (0=no, 1=yes) |

**Indexes:**
- `idx_created_at`: Descending index on `created_at` for efficient pagination

---

## Full-Text Search

### transcriptions_fts

FTS5 virtual table for full-text search on transcription content.

```sql
CREATE VIRTUAL TABLE IF NOT EXISTS transcriptions_fts USING fts5(
  text,
  content='transcriptions',
  content_rowid='id'
);
```

**Configuration:**
- External content table: Links to `transcriptions` table
- Content rowid: Uses `id` from main table
- Tokenizer: Default FTS5 tokenizer (unicode61)

**Search Syntax:**
FTS5 supports standard full-text search operators:
- `word` - Match exact word
- `word*` - Prefix search
- `"exact phrase"` - Phrase search
- `word1 AND word2` - Boolean AND
- `word1 OR word2` - Boolean OR
- `NOT word` - Exclusion

---

## Triggers

Three triggers keep the FTS index synchronized with the main table:

### Insert Trigger

```sql
CREATE TRIGGER IF NOT EXISTS transcriptions_ai AFTER INSERT ON transcriptions BEGIN
  INSERT INTO transcriptions_fts(rowid, text) VALUES (new.id, new.text);
END;
```

### Delete Trigger

```sql
CREATE TRIGGER IF NOT EXISTS transcriptions_ad AFTER DELETE ON transcriptions BEGIN
  INSERT INTO transcriptions_fts(transcriptions_fts, rowid, text)
  VALUES('delete', old.id, old.text);
END;
```

### Update Trigger

```sql
CREATE TRIGGER IF NOT EXISTS transcriptions_au AFTER UPDATE ON transcriptions BEGIN
  INSERT INTO transcriptions_fts(transcriptions_fts, rowid, text)
  VALUES('delete', old.id, old.text);
  INSERT INTO transcriptions_fts(rowid, text) VALUES (new.id, new.text);
END;
```

---

## Schema Migrations

The database service includes automatic schema migration for backwards compatibility.

**Migration Logic** (`migrateSchema` method):

```typescript
private migrateSchema() {
  const columns = this.db.prepare("PRAGMA table_info(transcriptions)").all();
  const columnNames = columns.map(c => c.name);

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
```

**Columns Added via Migration:**
- `duration_seconds` - Added for recording length tracking
- `tokens_used` - Added for API usage tracking
- `is_favorite` - Added for favoriting transcriptions

---

## Query Examples

### Save Transcription

```typescript
saveTranscription(text: string, durationSeconds?: number, tokensUsed?: number): number {
  const stmt = this.db.prepare(`
    INSERT INTO transcriptions (text, duration_seconds, tokens_used)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(text, durationSeconds ?? null, tokensUsed ?? null);
  return result.lastInsertRowid as number;
}
```

### Get Paginated Transcriptions

```typescript
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
```

### Full-Text Search

```typescript
searchTranscriptions(query: string, page: number = 1, limit: number = 20) {
  const offset = (page - 1) * limit;

  // Count matches
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
```

### Delete Transcription

```typescript
deleteTranscription(id: number): boolean {
  const stmt = this.db.prepare('DELETE FROM transcriptions WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}
```

### Toggle Favorite

```typescript
toggleFavorite(id: number): boolean {
  const stmt = this.db.prepare(`
    UPDATE transcriptions
    SET is_favorite = CASE WHEN is_favorite = 1 THEN 0 ELSE 1 END
    WHERE id = ?
  `);
  const result = stmt.run(id);
  return result.changes > 0;
}
```

### Get Statistics

```typescript
getStats(): { totalTranscriptions: number; totalDuration: number } {
  const stmt = this.db.prepare(`
    SELECT
      COUNT(*) as totalTranscriptions,
      COALESCE(SUM(duration_seconds), 0) as totalDuration
    FROM transcriptions
  `);
  return stmt.get() as { totalTranscriptions: number; totalDuration: number };
}
```

### Clear All History

```typescript
clearHistory(): void {
  this.db.exec('DELETE FROM transcriptions');
}
```

---

## TypeScript Interface

```typescript
export interface Transcription {
  id: number;
  text: string;
  duration_seconds: number | null;
  tokens_used: number | null;
  created_at: string;
  is_favorite: number;
}
```

---

## Notes

1. **WAL Mode**: Enabled for better concurrent read/write performance
2. **FTS5 Sync**: Triggers automatically maintain FTS index
3. **Tokens Tracking**: The `tokens_used` column is defined but not currently populated
4. **Favorites**: The `toggleFavorite` method exists but is not exposed via IPC
5. **Clear History**: Method exists but requires IPC implementation in main.ts
