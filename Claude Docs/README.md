# Visper Documentation

**Generated**: 2026-01-08
**Method**: Source code examination (not from existing documentation)

---

## About This Documentation

This documentation was created by systematically examining the actual source code of the Visper application. It reflects the **current implementation** as it exists in the codebase, not the original plan or design documents.

---

## Documentation Index

| Document | Description |
|----------|-------------|
| [architecture.md](./architecture.md) | System architecture, process model, service descriptions |
| [api-reference.md](./api-reference.md) | Complete API documentation for preload, IPC, and services |
| [database-schema.md](./database-schema.md) | SQLite schema, FTS5 search, triggers, migrations |
| [frontend-structure.md](./frontend-structure.md) | Svelte components, views, state management, styling |
| [key-flows.md](./key-flows.md) | User flows, data flows, error handling sequences |
| [setup-and-development.md](./setup-and-development.md) | Installation, development, building, troubleshooting |
| [tech-stack.md](./tech-stack.md) | Dependencies, versions, build configuration |
| [plan.md](./plan.md) | Original project plan (for reference, may differ from implementation) |

---

## Quick Start

```bash
# Install dependencies
npm install

# Create .env file with Gemini API key
echo "VITE_DEFAULT_GEMINI_KEY=your_key_here" > .env

# Start development
npm run dev

# Build for production
npm run build:electron
```

---

## Application Summary

**Visper** is a Windows desktop dictation application that:

1. Records audio via the system microphone
2. Transcribes speech using Google Gemini API
3. Automatically removes filler words
4. Copies the result to the clipboard
5. Stores transcription history locally

**Key Features:**
- Global hotkey (Win+J) to start/stop recording from anywhere
- System tray integration
- Local SQLite database for history
- Full-text search of past transcriptions
- Encrypted API key storage
- Light/Dark theme support

---

## Architecture Overview

```
Electron App
├── Main Process (Node.js)
│   ├── WindowService - Window management
│   ├── TrayService - System tray
│   ├── HotkeyService - Global shortcuts
│   ├── GeminiService - AI transcription
│   ├── DatabaseService - SQLite storage
│   └── SettingsService - Configuration
│
├── Preload Script
│   └── window.visperAPI - Secure bridge
│
└── Renderer Process (Svelte 5)
    ├── Views: Welcome, Dictation, History, Settings
    ├── Components: MicButton, Timer, Waveform, TranscriptBox, etc.
    └── Libraries: AudioRecorder, Sounds, Formatters
```

---

## Key Files Reference

| Purpose | File Path |
|---------|-----------|
| Main entry | `src/main/main.ts` |
| IPC bridge | `src/main/preload.ts` |
| AI transcription | `src/main/services/gemini.service.ts` |
| Database | `src/main/services/database.service.ts` |
| Settings | `src/main/services/settings.service.ts` |
| Root component | `src/renderer/App.svelte` |
| Recording UI | `src/renderer/views/Dictation.svelte` |
| Audio capture | `src/renderer/lib/audio-recorder.ts` |
| CSS tokens | `src/renderer/styles/global.css` |

---

## Notes on Documentation Accuracy

This documentation was created by examining the actual source code. Some observations:

1. **node-global-key-listener**: Listed in dependencies but not actually used. The code uses Electron's built-in `globalShortcut` API instead.

2. **tokens_used column**: Defined in database schema but never populated by the application.

3. **toggleFavorite**: Method exists in DatabaseService but is not exposed via IPC.

4. **clearHistory**: Method exists but the Settings view's "Clear All History" button shows a confirm dialog without actually calling the IPC method.

5. **Stores folder**: The plan mentions a `stores/` folder with Svelte stores, but the implementation uses Svelte 5 Runes (`$state`, `$derived`) directly in components instead.

These discrepancies between the plan and implementation are normal during development and reflect the actual shipped behavior.

---

## Maintenance

When updating the codebase:

1. Run the application and test changes
2. Update relevant documentation files
3. Keep the documentation in sync with code changes
4. Note any discrepancies between plan and implementation
