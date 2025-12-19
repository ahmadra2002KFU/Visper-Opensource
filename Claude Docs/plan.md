# Visper - Dictation Application Plan

## Overview

**Visper** is a lightweight Electron-based dictation application for Windows that replaces the native Windows+H transcription with a superior experience using Gemini Flash 3 API.

**Core Value Proposition**: Voice-to-text in under 3 seconds total overhead (vs 4-6s for Windows+H)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ELECTRON APP                                  │
├─────────────────────────────────────────────────────────────────────┤
│  MAIN PROCESS                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │ Hotkey       │  │ System       │  │ Window                   │   │
│  │ Service      │  │ Tray         │  │ Manager                  │   │
│  │ (Win+J)      │  │              │  │                          │   │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                         SERVICES                               │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐   │   │
│  │  │ Gemini    │  │ SQLite    │  │ Settings  │  │ Audio     │   │   │
│  │  │ API       │  │ Database  │  │ Store     │  │ Handler   │   │   │
│  │  └───────────┘  └───────────┘  └───────────┘  └───────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  PRELOAD (Context Bridge - Secure IPC)                               │
├─────────────────────────────────────────────────────────────────────┤
│  RENDERER PROCESS (Svelte 5)                                         │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  VIEWS: Welcome | Dictation | History | Settings              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  STORES: recording | settings | history | ui | audio          │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Framework** | Electron 33+ | Required for global hotkeys, system tray, taskbar |
| **UI Framework** | Svelte 5 | ~2KB runtime, compile-time reactivity with runes |
| **Build Tool** | Vite 6 | Fast HMR, excellent tree-shaking |
| **Database** | better-sqlite3 | Synchronous, fast, WAL mode for concurrency |
| **Settings** | electron-store + safeStorage | Encrypted API key storage via Windows DPAPI |
| **Audio Format** | WAV (16kHz mono 16-bit) | Optimal for Gemini (32 tokens/sec) |
| **Packaging** | electron-builder | Best Windows support (NSIS installer) |
| **Hotkey** | node-global-key-listener | Reliable Win+J without Windows key override |

---

## Project Structure

```
visper/
├── package.json
├── vite.config.ts
├── electron-builder.yml
├── .env.example                    # GEMINI_API_KEY placeholder
├── Claude Docs/
│   └── plan.md
├── build/
│   ├── icon.ico                    # App icon (256x256)
│   ├── tray-idle.ico               # Blue tray icon
│   └── tray-recording.ico          # Red tray icon
├── src/
│   ├── main/
│   │   ├── main.ts                 # Main process entry
│   │   ├── preload.ts              # Context bridge
│   │   └── services/
│   │       ├── hotkey.service.ts   # Win+J registration
│   │       ├── gemini.service.ts   # Transcription API
│   │       ├── database.service.ts # SQLite operations
│   │       ├── settings.service.ts # Encrypted settings
│   │       ├── audio.service.ts    # Audio file handling
│   │       ├── tray.service.ts     # System tray
│   │       └── window.service.ts   # Window management
│   └── renderer/
│       ├── index.html
│       ├── main.ts                 # Svelte entry
│       ├── App.svelte              # Root component
│       ├── views/
│       │   ├── Welcome.svelte      # First-launch setup
│       │   ├── Dictation.svelte    # Main recording UI
│       │   ├── History.svelte      # Past transcriptions
│       │   └── Settings.svelte     # API key & preferences
│       ├── components/
│       │   ├── ui/
│       │   │   ├── Button.svelte
│       │   │   ├── Input.svelte
│       │   │   └── Toggle.svelte
│       │   ├── layout/
│       │   │   ├── TitleBar.svelte
│       │   │   └── NavBar.svelte
│       │   ├── dictation/
│       │   │   ├── MicButton.svelte
│       │   │   ├── Timer.svelte
│       │   │   ├── Waveform.svelte
│       │   │   └── TranscriptBox.svelte
│       │   ├── history/
│       │   │   ├── HistoryItem.svelte
│       │   │   └── SearchBar.svelte
│       │   └── feedback/
│       │       └── Toast.svelte
│       ├── stores/
│       │   ├── recording.svelte.ts
│       │   ├── settings.svelte.ts
│       │   ├── history.svelte.ts
│       │   ├── ui.svelte.ts
│       │   └── audio.svelte.ts
│       ├── lib/
│       │   ├── ipc.ts              # IPC wrapper
│       │   ├── audio-recorder.ts   # Web Audio API
│       │   ├── sounds.ts           # Sound feedback (Web Audio)
│       │   └── formatters.ts       # Time, text utilities
│       └── styles/
│           ├── global.css
│           ├── tokens.css          # Design system variables
│           └── animations.css
└── tests/
```

---

## Core Features

### 1. Global Hotkey (Win+J)

**Implementation**: `node-global-key-listener` package (more reliable than Electron's globalShortcut for Windows key combinations)

**Behavior**:
- Win+J in IDLE state → Show window + start recording
- Win+J in RECORDING state → Stop recording + process
- Win+J in RESULT state → Copy to clipboard + clear
- Windows key alone still opens Start menu (no interference)
- Fallback: Ctrl+Alt+J if Win+J fails

```typescript
// hotkey.service.ts
import { GlobalKeyboardListener } from 'node-global-key-listener';

const listener = new GlobalKeyboardListener();
let winPressed = false;

listener.addListener((e) => {
  if (e.name === 'LEFT META' || e.name === 'RIGHT META') {
    winPressed = e.state === 'DOWN';
  }
  if (winPressed && e.name === 'J' && e.state === 'DOWN') {
    mainWindow.webContents.send('hotkey:toggle-recording');
  }
});
```

### 2. Audio Recording

**Approach**: Web Audio API in renderer process

- Record as WAV (16kHz mono 16-bit) - optimal for Gemini
- Use MediaRecorder with `audio/webm;codecs=opus` then convert
- Enable noise suppression and echo cancellation
- Real-time waveform visualization via AnalyserNode

```typescript
// audio-recorder.ts
const stream = await navigator.mediaDevices.getUserMedia({
  audio: {
    sampleRate: 16000,
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true
  }
});
```

### 3. Gemini API Transcription

**Model**: `gemini-2.0-flash-exp` (or `gemini-2.5-flash` when available)

**System Instruction** (filters filler words):
```
You are a precise audio transcription assistant. Your task is to:
1. REMOVE all filler words: "um", "uh", "er", "ah", "like" (as filler),
   "you know", "basically", verbal pauses, repeated stuttering words
2. PRESERVE the speaker's intended meaning
3. CORRECT obvious grammatical speech errors
4. OUTPUT only clean transcription text, nothing else
5. If audio is unclear or silent, respond with "[inaudible]"
```

**API Call**:
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  systemInstruction: TRANSCRIPTION_PROMPT
});

const result = await model.generateContent([
  { inlineData: { mimeType: 'audio/wav', data: base64Audio } },
  { text: 'Transcribe this audio.' }
]);
```

**Token Usage**: ~32 tokens/second of audio (1 min = 1,920 tokens)

### 4. SQLite Database Schema

```sql
-- Transcriptions table
CREATE TABLE transcriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  duration_seconds REAL,
  tokens_used INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_favorite INTEGER DEFAULT 0
);

CREATE INDEX idx_created_at ON transcriptions(created_at DESC);

-- Full-text search
CREATE VIRTUAL TABLE transcriptions_fts USING fts5(
  text,
  content='transcriptions',
  content_rowid='id'
);

-- Settings (non-sensitive)
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
```

### 5. IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `recording:toggle` | M→R | Hotkey triggered |
| `recording:start` | R→M | Begin capture |
| `recording:stop` | R→M | Stop and process |
| `recording:audio-data` | R→M | Send audio buffer |
| `transcription:result` | M→R | Return text |
| `transcription:error` | M→R | Error notification |
| `history:get` | R→M | Fetch (paginated) |
| `history:search` | R→M | Search transcriptions |
| `history:delete` | R→M | Remove entry |
| `settings:get` | R→M | Load settings |
| `settings:set` | R→M | Update settings |
| `settings:test-api` | R→M | Validate API key |
| `clipboard:copy` | R→M | Copy text |
| `window:minimize` | R→M | Minimize to tray |

---

## Design System: "Crystalline Precision"

### Colors

**Light Theme**:
```css
--color-primary: #1e293b;        /* Deep Slate Blue */
--color-accent: #f97316;         /* Vivid Coral */
--color-recording: #ef4444;      /* Crimson */
--color-success: #10b981;        /* Emerald */
--color-error: #f43f5e;          /* Rose */
--color-bg-primary: #fafaf9;     /* Warm Stone */
--color-bg-glass: rgba(255, 255, 255, 0.65);
```

**Dark Theme**:
```css
--color-primary: #f5f5f4;
--color-accent: #fbbf24;         /* Warm Amber */
--color-recording: #f87171;
--color-bg-primary: #0c0a09;
--color-bg-glass: rgba(28, 25, 23, 0.75);
```

### Typography

**Font**: Plus Jakarta Sans (variable, 200-800 weights)
- Base: 16px
- Headings: Bricolage Grotesque for character

### Window

- **Size**: 320x420px (compact, resizable)
- **Border Radius**: 24px
- **Glass Effect**: `backdrop-filter: blur(32px) saturate(180%)`
- **Frameless**: Custom title bar with drag region

### Microphone Button (Hero - 88px)

**States**:
1. **Idle**: Coral fill, subtle shadow, scale 1.0
2. **Hover**: Scale 1.02, increased glow
3. **Recording**: Red, 3 animated pulse rings, breathing animation
4. **Processing**: Muted, spinning arc indicator
5. **Success**: Green flash, checkmark animation

---

## User Flows

### Quick Dictation (Primary Flow)

```
1. Press Win+J ────────────────> Window appears (if hidden)
                                  Recording starts immediately
2. Speak naturally ────────────> Waveform animates, timer counts
3. Press Win+J again ──────────> Recording stops
                                  "Processing..." indicator
4. Transcription appears ──────> Text shown, AUTO-COPIED
5. Paste in target app ────────> Done!
```

**Target**: Under 3 seconds total overhead

### State Machine

```
IDLE ──[Win+J/Click]──> RECORDING ──[Win+J/Click]──> PROCESSING ──[Success]──> RESULT
  ^                          |                            |                      |
  |                      [Escape]                     [Error]               [Win+J]
  |                          |                            |                      |
  └──────────────────────────┴────────────────────────────┴──────────────────────┘
```

### First Launch Flow

1. Welcome screen with feature highlights
2. Microphone permission request
3. Optional API key input (has default)
4. "Get Started" → Main dictation view

---

## Views Specification

### 1. Welcome.svelte
- Logo + tagline ("Your voice, transcribed")
- 3 feature highlights with icons
- API key input (optional, masked)
- "Get Started" button
- Skip tutorial option

### 2. Dictation.svelte (Main)
- Large MicButton (88px, center)
- Timer below button (00:00 format)
- Waveform visualization (24 bars)
- TranscriptBox (scrollable, with copy button)
- Bottom nav: History | Settings icons
- Minimize to tray button in title bar

### 3. History.svelte
- SearchBar at top
- Grouped by day (Today, Yesterday, date)
- HistoryItem: preview text + timestamp + copy/delete
- Infinite scroll pagination
- Empty state illustration

### 4. Settings.svelte
- API Key section (masked input + test button)
- Default key indicator
- Theme toggle (Light/Dark/System)
- Hotkey display (Win+J)
- Clear history button (with confirmation)
- App version in footer

---

## Dependencies

```json
{
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "better-sqlite3": "^11.0.0",
    "electron-store": "^10.0.0",
    "node-global-key-listener": "^0.3.0"
  },
  "devDependencies": {
    "electron": "^33.0.0",
    "electron-builder": "^25.0.0",
    "@sveltejs/vite-plugin-svelte": "^4.0.0",
    "svelte": "^5.0.0",
    "vite": "^6.0.0",
    "typescript": "^5.0.0"
  }
}
```

**Bundle Size Target**: < 50KB gzipped (renderer)

---

## Implementation Phases

### Phase 1: Foundation
- [x] Plan complete
- [ ] Initialize Electron + Vite + Svelte 5 project
- [ ] Set up TypeScript configuration
- [ ] Create main process structure
- [ ] Implement preload script with secure IPC
- [ ] Create window manager service

### Phase 2: Core Recording
- [ ] Implement Web Audio recording in renderer
- [ ] Create audio-recorder.ts with WAV conversion
- [ ] Set up Gemini API service with filler filtering
- [ ] Wire IPC for recording flow
- [ ] Build MicButton, Timer, Waveform components

### Phase 3: Database & History
- [ ] Set up SQLite with better-sqlite3
- [ ] Implement database service with FTS5
- [ ] Create history storage/retrieval
- [ ] Build History view with search
- [ ] Add pagination

### Phase 4: System Integration
- [ ] Implement hotkey service with node-global-key-listener
- [ ] Register Win+J without Windows key override
- [ ] Create system tray with recording indicator
- [ ] Add taskbar integration
- [ ] Handle minimize to tray

### Phase 5: Settings & Polish
- [ ] Create Settings view
- [ ] Implement encrypted API key storage
- [ ] Add theme support (Light/Dark/System)
- [ ] Build Welcome page flow
- [ ] Add toast notifications
- [ ] Keyboard navigation

### Phase 6: Build & Package
- [ ] Configure electron-builder for Windows
- [ ] Create app icons (ICO format)
- [ ] Build NSIS installer
- [ ] Test installation and auto-launch
- [ ] Final testing

---

## Critical Files to Implement

| Priority | File | Purpose |
|----------|------|---------|
| 1 | `src/main/main.ts` | Main process entry, app lifecycle |
| 2 | `src/main/preload.ts` | Secure IPC context bridge |
| 3 | `src/main/services/hotkey.service.ts` | Win+J without override |
| 4 | `src/main/services/gemini.service.ts` | Transcription with filtering |
| 5 | `src/main/services/database.service.ts` | SQLite + FTS5 |
| 6 | `src/renderer/views/Dictation.svelte` | Main UI |
| 7 | `src/renderer/components/dictation/MicButton.svelte` | Hero button |
| 8 | `src/renderer/lib/audio-recorder.ts` | Web Audio capture |

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Hotkey to recording | < 100ms |
| Recording stop to API call | < 200ms |
| Short transcription (< 30s) | < 3s |
| App cold start | < 2s |
| Memory usage | < 150MB |
| Renderer bundle | < 50KB |

---

## Error Handling

| Scenario | User Experience |
|----------|-----------------|
| No internet | "Offline - recording saved" + retry button |
| Invalid API key | Direct to settings with error message |
| No microphone | Link to Windows sound settings |
| Recording < 0.5s | Auto-cancel, no processing |
| Recording > 5min | Warning at 2min, auto-stop at 5min |
| API rate limit | Auto-retry with countdown timer |
| Hotkey conflict | Use fallback Ctrl+Alt+J, notify user |

---

## Security Model

| Risk | Mitigation |
|------|------------|
| API Key Exposure | `safeStorage` (Windows DPAPI encryption) |
| IPC Injection | Sender URL validation, whitelisted channels |
| XSS | `contextIsolation: true`, `nodeIntegration: false` |
| Path Traversal | Validate paths against allowed directories |
| Sensitive Data | No audio files stored by default |

---

## Accessibility

- Full keyboard navigation (Tab, Enter, Escape)
- Win+J global hotkey works from any app
- ARIA live regions for status changes
- WCAG AA contrast ratios (4.5:1)
- `prefers-reduced-motion` respected
- Screen reader announcements at state changes

---

## Configuration Decisions

| Setting | Choice | Notes |
|---------|--------|-------|
| **Default API Key** | User will provide | Embed in `.env` file, users can override in Settings |
| **Default Theme** | Light | Warm stone backgrounds, coral accent |
| **Win+J on Result** | Auto-copy + clear | Fastest workflow - copies and resets in one action |
| **Sound Feedback** | Enabled | Subtle sounds for start/stop/success |
| **Auto-start** | Not included | User can enable via Windows settings if desired |
| **Always on Top** | Not included | Keeps app simple |

## Default Gemini API Key

The app includes a default API key (provided by user) for immediate use. Users can override with their own key in Settings for higher rate limits.

```typescript
// .env file
VITE_DEFAULT_GEMINI_KEY=your_key_here

// gemini.service.ts
const DEFAULT_API_KEY = import.meta.env.VITE_DEFAULT_GEMINI_KEY || '';
const userKey = await settings.getApiKey();
const activeKey = userKey || DEFAULT_API_KEY;
```

## Sound Feedback

Subtle audio cues for recording states:
- **Recording Start**: Soft "blip" (200ms, 440Hz)
- **Recording Stop**: Gentle "boop" (200ms, 330Hz)
- **Success**: Pleasant chime (300ms, ascending)
- **Error**: Soft alert (200ms, 220Hz)

```typescript
// sounds.ts - Web Audio API
export const playSound = (type: 'start' | 'stop' | 'success' | 'error') => {
  const ctx = new AudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  // Configure based on type...
};
```

---

## Sources

- [Gemini Audio API Documentation](https://ai.google.dev/gemini-api/docs/audio)
- [Electron Global Shortcut](https://www.electronjs.org/docs/latest/api/global-shortcut)
- [node-global-key-listener](https://www.npmjs.com/package/node-global-key-listener)
- [Electron Context Isolation](https://www.electronjs.org/docs/latest/tutorial/context-isolation)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- [Svelte 5 Runes](https://svelte.dev/docs/svelte/$state)
