# Visper Architecture Documentation

**Last Updated**: 2026-01-08
**Based on**: Actual source code examination

---

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Main Process](#main-process)
4. [Renderer Process](#renderer-process)
5. [IPC Communication](#ipc-communication)
6. [Security Model](#security-model)
7. [Data Flow](#data-flow)

---

## Overview

Visper is an Electron-based desktop dictation application that uses the Google Gemini API for audio transcription. The application is built with:

- **Electron 33** - Desktop framework
- **Svelte 5** - Frontend UI framework (with Runes)
- **TypeScript** - Type-safe development
- **better-sqlite3** - Local database storage
- **Google Generative AI SDK** - Audio transcription

The application follows Electron's multi-process architecture with strict context isolation for security.

---

## System Architecture

```
+----------------------------------------------------------+
|                      ELECTRON APP                         |
+----------------------------------------------------------+
|                                                          |
|  +---------------------------------------------------+   |
|  |                  MAIN PROCESS                      |   |
|  |  src/main/main.ts                                  |   |
|  |                                                    |   |
|  |  +-------------+  +-------------+  +-------------+ |   |
|  |  | WindowSvc   |  | TraySvc     |  | HotkeySvc   | |   |
|  |  | (window.    |  | (tray.      |  | (hotkey.    | |   |
|  |  | service.ts) |  | service.ts) |  | service.ts) | |   |
|  |  +-------------+  +-------------+  +-------------+ |   |
|  |                                                    |   |
|  |  +-------------+  +-------------+  +-------------+ |   |
|  |  | GeminiSvc   |  | DatabaseSvc |  | SettingsSvc | |   |
|  |  | (gemini.    |  | (database.  |  | (settings.  | |   |
|  |  | service.ts) |  | service.ts) |  | service.ts) | |   |
|  |  +-------------+  +-------------+  +-------------+ |   |
|  +---------------------------------------------------+   |
|                          |                               |
|                    IPC BRIDGE                            |
|                          |                               |
|  +---------------------------------------------------+   |
|  |                 PRELOAD SCRIPT                     |   |
|  |  src/main/preload.ts                               |   |
|  |  Exposes: window.visperAPI                         |   |
|  +---------------------------------------------------+   |
|                          |                               |
|  +---------------------------------------------------+   |
|  |               RENDERER PROCESS                     |   |
|  |  src/renderer/                                     |   |
|  |                                                    |   |
|  |  +--------+  +-----------+  +----------+           |   |
|  |  | Views  |  | Components|  | Libraries |           |   |
|  |  +--------+  +-----------+  +----------+           |   |
|  |                                                    |   |
|  |  App.svelte (Root)                                 |   |
|  +---------------------------------------------------+   |
|                                                          |
+----------------------------------------------------------+
```

---

## Main Process

### Entry Point: `src/main/main.ts`

The main process initializes all services and handles the application lifecycle.

**Key Responsibilities:**

1. **Single Instance Lock**: Ensures only one instance of the app runs
2. **Service Initialization**: Creates and manages all backend services
3. **IPC Handler Registration**: Sets up all IPC channels before window creation
4. **Application Lifecycle**: Handles app ready, window-all-closed, and before-quit events

**Initialization Order:**
```typescript
1. app.requestSingleInstanceLock()
2. app.whenReady()
   a. SettingsService
   b. DatabaseService
   c. GeminiService (requires SettingsService)
   d. setupIpcHandlers()
   e. WindowService.createMainWindow()
   f. TrayService (requires WindowService)
   g. HotkeyService (requires WindowService)
```

### Services

#### WindowService (`src/main/services/window.service.ts`)

Manages the main BrowserWindow instance.

**Window Configuration:**
- Dimensions: 280x420 (min: 260x380, max: 360x550)
- Position: Bottom-right corner of screen
- Frame: Frameless with transparent background
- Security: Context isolation enabled, sandbox enabled, node integration disabled

**Key Methods:**
- `createMainWindow()` - Creates and configures the main window
- `show()` / `hide()` - Window visibility control
- `minimizeToTray()` - Hides window (does not close)
- `toggleVisibility()` - Toggles between show/hide
- `sendToRenderer(channel, ...args)` - Sends IPC messages to renderer

#### TrayService (`src/main/services/tray.service.ts`)

Manages the system tray icon and context menu.

**Features:**
- Dynamic icon (normal vs recording indicator)
- Context menu with actions: Start/Stop Recording, Show Window, History, Settings, Quit
- Single-click toggles window visibility
- Double-click shows window
- Balloon notifications support

**Icon States:**
- Normal: App icon resized to 16x16
- Recording: Red dot with white center (SVG-based)

#### HotkeyService (`src/main/services/hotkey.service.ts`)

Registers global keyboard shortcuts using Electron's `globalShortcut` API.

**Hotkey Configuration:**
- Primary: `Super+J` (Windows key + J)
- Fallback: `Ctrl+Alt+J` (if primary fails)

**Behavior:**
- Shows window if hidden
- Sends `hotkey:toggle-recording` event to renderer

#### GeminiService (`src/main/services/gemini.service.ts`)

Handles audio transcription using Google's Generative AI SDK.

**Model Configuration:**
- Model: `gemini-2.0-flash-exp`
- Input: WAV audio as base64 (MIME type: `audio/wav`)

**System Instruction (Transcription Prompt):**
```
You are a precise audio transcription assistant. Your task is to:
1. REMOVE all filler words: "um", "uh", "er", "ah", "like" (when used as filler),
   "you know", "basically", verbal pauses, repeated stuttering words
2. PRESERVE the speaker's intended meaning exactly
3. CORRECT obvious grammatical speech errors while maintaining the speaker's voice
4. OUTPUT only the clean transcription text, nothing else - no quotes, no labels,
   no explanations
5. If audio is unclear or silent, respond with "[inaudible]"
```

**API Key Priority:**
1. User-provided key (stored encrypted)
2. Default key from environment variable (`VITE_DEFAULT_GEMINI_KEY`)

**Key Methods:**
- `transcribe(audioBuffer: ArrayBuffer)` - Transcribes audio
- `testConnection(apiKey?: string)` - Validates API key
- `refreshClient()` - Reinitializes the API client

#### DatabaseService (`src/main/services/database.service.ts`)

SQLite database operations using better-sqlite3.

**Database Location:** `%APPDATA%/visper/visper.db`

**Configuration:**
- Journal mode: WAL (Write-Ahead Logging)
- Automatic schema migration

**Key Methods:**
- `saveTranscription(text, durationSeconds?, tokensUsed?)` - Saves transcription
- `getTranscriptions(page, limit)` - Paginated retrieval
- `searchTranscriptions(query, page, limit)` - Full-text search via FTS5
- `deleteTranscription(id)` - Removes transcription
- `toggleFavorite(id)` - Toggle favorite status
- `getStats()` - Returns total count and duration
- `clearHistory()` - Deletes all transcriptions

#### SettingsService (`src/main/services/settings.service.ts`)

Manages application settings and secure API key storage.

**Storage:**
- Non-sensitive: electron-store (JSON file)
- API Key: Windows DPAPI encryption via `safeStorage`

**Settings Schema:**
```typescript
interface Settings {
  theme: 'light' | 'dark' | 'system';
  soundEnabled: boolean;
  firstLaunchComplete: boolean;
  hotkey: string;
}
```

**Defaults:**
- theme: 'light'
- soundEnabled: true
- firstLaunchComplete: false
- hotkey: 'Super+J'

**Key Methods:**
- `getAll()` / `get(key)` / `set(key, value)` - Settings CRUD
- `getApiKey()` / `setApiKey(key)` / `clearApiKey()` - Encrypted key management
- `isFirstLaunch()` / `completeSetup()` - First-run detection

---

## Renderer Process

### Entry Point: `src/renderer/main.ts`

Mounts the Svelte application to the DOM.

```typescript
import { mount } from 'svelte';
import App from './App.svelte';
import './styles/global.css';

const app = mount(App, {
  target: document.getElementById('app')!
});
```

### Root Component: `src/renderer/App.svelte`

**State Management:**
- Uses Svelte 5 Runes (`$state`, `$derived`, `$props`)
- No external state management library

**Navigation:**
- View-based routing (not URL-based)
- Views: `welcome`, `dictation`, `history`, `settings`

**Global Functions Exposed:**
- `window.visperNavigate(view)` - Programmatic navigation
- `window.visperToast(message, type)` - Show toast notifications

### Views

| View | File | Purpose |
|------|------|---------|
| Welcome | `views/Welcome.svelte` | First-launch setup, API key input |
| Dictation | `views/Dictation.svelte` | Main recording interface |
| History | `views/History.svelte` | Past transcriptions browser |
| Settings | `views/Settings.svelte` | App configuration |

### Component Hierarchy

```
App.svelte
├── TitleBar.svelte (layout)
├── Welcome.svelte (view)
│   └── API key validation flow
├── Dictation.svelte (view)
│   ├── MicButton.svelte
│   ├── Timer.svelte
│   ├── Waveform.svelte
│   ├── TranscriptBox.svelte
│   └── NavBar.svelte
├── History.svelte (view)
│   ├── Search input
│   ├── Grouped items (by date)
│   └── NavBar.svelte
├── Settings.svelte (view)
│   ├── API Key section
│   ├── Theme selector
│   ├── Sound toggle
│   ├── Hotkey display
│   └── NavBar.svelte
└── Toast.svelte (feedback)
```

---

## IPC Communication

### Preload Script: `src/main/preload.ts`

Exposes a secure API to the renderer via `contextBridge`.

**API Namespace:** `window.visperAPI`

### IPC Channels

| Channel | Type | Direction | Purpose |
|---------|------|-----------|---------|
| `recording:audio-data` | invoke | R -> M | Send audio buffer for transcription |
| `history:get` | invoke | R -> M | Get paginated history |
| `history:search` | invoke | R -> M | Full-text search |
| `history:delete` | invoke | R -> M | Delete transcription |
| `history:save` | invoke | R -> M | Save new transcription |
| `settings:get` | invoke | R -> M | Get all settings |
| `settings:set` | invoke | R -> M | Update setting value |
| `settings:get-api-key` | invoke | R -> M | Get encrypted API key |
| `settings:set-api-key` | invoke | R -> M | Save encrypted API key |
| `settings:test-api` | invoke | R -> M | Validate API key |
| `clipboard:copy` | invoke | R -> M | Copy text to clipboard |
| `window:minimize` | send | R -> M | Minimize to tray |
| `window:close` | send | R -> M | Close (minimize to tray) |
| `app:is-first-launch` | invoke | R -> M | Check first launch status |
| `app:complete-setup` | invoke | R -> M | Mark setup complete |
| `hotkey:toggle-recording` | send | M -> R | Hotkey triggered |

### API Structure

```typescript
window.visperAPI = {
  recording: {
    sendAudioData(audioBuffer: ArrayBuffer): Promise<{success, text?, error?}>,
    onToggle(callback: () => void): () => void  // Returns unsubscribe function
  },
  history: {
    get(page: number, limit: number): Promise<{items, total}>,
    search(query: string, page: number, limit: number): Promise<{items, total}>,
    delete(id: number): Promise<boolean>,
    save(text: string, durationSeconds: number): Promise<number>
  },
  settings: {
    get(): Promise<Settings>,
    set(key: string, value: any): Promise<void>,
    getApiKey(): Promise<string | null>,
    setApiKey(key: string): Promise<{success, error?}>,
    testApi(key?: string): Promise<{success, error?}>
  },
  clipboard: {
    copy(text: string): Promise<boolean>
  },
  window: {
    minimize(): void,
    close(): void
  },
  app: {
    isFirstLaunch(): Promise<boolean>,
    completeSetup(): Promise<void>
  }
}
```

---

## Security Model

### Context Isolation

The application implements Electron's recommended security practices:

```typescript
webPreferences: {
  preload: path.join(__dirname, '..', 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
}
```

### API Key Protection

1. **Storage**: Uses Windows DPAPI via Electron's `safeStorage`
2. **Location**: `%APPDATA%/visper/secure-key.enc`
3. **Fallback**: Plain text if encryption unavailable (not recommended)

### Content Security Policy

Defined in `src/renderer/index.html`:
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self' http://localhost:* ws://localhost:*;
  script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:*;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  connect-src 'self' http://localhost:* ws://localhost:*;
">
```

---

## Data Flow

### Audio Transcription Flow

```
1. User presses Win+J or clicks mic button
   ↓
2. AudioRecorder.start() - Requests microphone access
   ↓
3. MediaRecorder captures audio (WebM/Opus format)
   ↓
4. Real-time waveform visualization via AnalyserNode
   ↓
5. User stops recording (Win+J or click)
   ↓
6. AudioRecorder.stop() converts WebM to WAV (16kHz mono 16-bit)
   ↓
7. window.visperAPI.recording.sendAudioData(wavBuffer)
   ↓
8. IPC: 'recording:audio-data' → Main Process
   ↓
9. GeminiService.transcribe(audioBuffer)
   a. Convert ArrayBuffer to base64
   b. Call Gemini API with audio and transcription prompt
   c. Return cleaned transcription text
   ↓
10. IPC Response: {success: true, text: "transcription"}
    ↓
11. DatabaseService.saveTranscription()
    ↓
12. clipboard.writeText() - Auto-copy
    ↓
13. UI updates with transcription and toast notification
```

### Settings Flow

```
1. Settings.svelte loads via onMount
   ↓
2. window.visperAPI.settings.get() → IPC → SettingsService.getAll()
   ↓
3. User changes setting (e.g., theme)
   ↓
4. window.visperAPI.settings.set('theme', 'dark')
   ↓
5. IPC: 'settings:set' → SettingsService.set()
   ↓
6. electron-store saves to JSON file
   ↓
7. UI applies theme via data-theme attribute
```

---

## File Structure Summary

```
src/
├── main/
│   ├── main.ts              # Entry point, IPC handlers
│   ├── preload.ts           # Context bridge API
│   └── services/
│       ├── window.service.ts    # Window management
│       ├── tray.service.ts      # System tray
│       ├── hotkey.service.ts    # Global shortcuts
│       ├── gemini.service.ts    # AI transcription
│       ├── database.service.ts  # SQLite operations
│       └── settings.service.ts  # Config & encryption
└── renderer/
    ├── index.html           # HTML template
    ├── main.ts              # Svelte mount
    ├── App.svelte           # Root component
    ├── views/               # Page components
    ├── components/          # Reusable UI
    ├── lib/                 # Utilities
    └── styles/              # CSS design system
```
