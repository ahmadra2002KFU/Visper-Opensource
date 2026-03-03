# Visper Tauri - Codebase Analysis

## What Is Visper?

A lightweight Windows desktop dictation app. Press **Win+J**, speak, and get a cleaned transcription auto-copied to your clipboard. Built with **Tauri v2 + Svelte 5 + Rust**, using **Google Gemini 2.5 Flash** for speech-to-text.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│  Frontend (Svelte 5 + TypeScript)               │
│  src/renderer/                                  │
│    App.svelte → view router (manual state)      │
│    views/  Welcome | Dictation | History | Settings │
│    components/  MicButton | Timer | Waveform | TranscriptBox | NavBar | TitleBar | Toast │
│    lib/  audio-recorder.ts | tauri-api.ts | formatters.ts | sounds.ts │
├─────────────────────────────────────────────────┤
│  IPC Bridge (tauri-api.ts → window.visperAPI)   │
│  14 Tauri invoke commands + 1 event listener    │
├─────────────────────────────────────────────────┤
│  Backend (Rust)                                 │
│  src-tauri/src/                                 │
│    lib.rs    → app setup, commands, hotkey, tray │
│    services/ → database.rs | gemini.rs | settings.rs │
│  Storage:                                       │
│    SQLite DB: %LOCALAPPDATA%/Visper/visper.db   │
│    Settings:  %APPDATA%/Visper/settings.json    │
│    API Key:   Windows Credential Manager        │
└─────────────────────────────────────────────────┘
```

---

## Core Data Flow (Recording → Transcription)

1. User presses Win+J (or clicks mic button)
2. Frontend captures audio via `MediaRecorder` (WebM/Opus) at 16kHz mono
3. WebM is decoded and converted to WAV in-browser (`audio-recorder.ts`)
4. WAV bytes sent as `number[]` over Tauri IPC → Rust `send_audio_data` command
5. Rust base64-encodes audio, POSTs to Gemini 2.5 Flash API with transcription prompt
6. Clean transcription returned → saved to SQLite, copied to clipboard, shown in UI

---

## All 14 Tauri Commands

| Command | Purpose |
|---|---|
| `send_audio_data` | Send audio bytes to Gemini for transcription |
| `history_get` | Paginated fetch of transcription history |
| `history_search` | FTS5 full-text search over transcriptions |
| `history_save` | Save a transcription entry |
| `history_delete` | Delete one transcription |
| `history_clear` | Delete all history + rebuild FTS index |
| `toggle_favorite` | Toggle favorite flag on a transcription |
| `settings_get` | Get all settings |
| `settings_set` | Set a single setting by key |
| `get_api_key` | Read API key from OS keyring |
| `set_api_key` | Store API key in OS keyring |
| `test_api` | Test a Gemini API key with a ping |
| `delete_api_key` | Remove API key from keyring |
| `is_first_launch` / `complete_setup` | Onboarding flow control |

---

## Database Schema

- **Table:** `transcriptions` (id, text, duration_seconds, tokens_used, created_at, is_favorite)
- **FTS5:** `transcriptions_fts` (content-table index on `text`)
- **Triggers:** Auto-sync FTS on INSERT/DELETE/UPDATE
- **WAL mode** enabled

---

## Settings

Stored in `%APPDATA%/Visper/settings.json`:
- `theme`: "light" | "dark" | "system"
- `soundEnabled`: boolean
- `firstLaunchComplete`: boolean
- `hotkey`: string (stored but not actually used at runtime)

---

## Known Issues & Technical Debt

### Backend
1. **std::sync::Mutex in async commands** — DB and settings use sync Mutex in async Tauri commands; risk of blocking async thread pool
2. **`tokens_used` column never written** — always NULL, dead schema
3. **`hotkey` setting has no runtime effect** — hotkey is hardcoded to Win+J
4. **FTS5 query injection** — special characters like AND/OR/NOT not escaped
5. **500ms startup thread** — spawns OS thread just for a delay; should use tokio

### Frontend
6. **ArrayBuffer→number[] IPC is slow** — should use Tauri v2 binary transfer
7. **System theme doesn't react to OS changes** — no `matchMedia` listener
8. **Version hardcoded as v1.0.0** in Settings, but package.json is 1.1.2
9. **`window.confirm()` for destructive actions** — inconsistent with custom UI
10. **`copyAndClear` function is dead code** in Dictation.svelte
11. **Favorite feature has backend support but no UI**
12. **TranscriptBox max-height fixed at 100px** — cramped for long transcriptions
13. **Theme logic duplicated** in App.svelte and Settings.svelte
14. **Search requires Enter key** — no debounced live search

---

## Key Dependencies

**Rust:** tauri 2, rusqlite (bundled), reqwest (rustls-tls), keyring 3, tokio, serde, base64, dirs, anyhow

**Frontend:** svelte 5, vite 6, @tauri-apps/api 2, @tauri-apps/plugin-clipboard-manager, @tauri-apps/plugin-global-shortcut
