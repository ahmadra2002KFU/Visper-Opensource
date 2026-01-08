# Tech Stack Documentation

**Last Updated**: 2026-01-08
**Based on**: package.json and actual source code examination

---

## Table of Contents

1. [Overview](#overview)
2. [Runtime Dependencies](#runtime-dependencies)
3. [Development Dependencies](#development-dependencies)
4. [Build Configuration](#build-configuration)
5. [Environment Variables](#environment-variables)
6. [File Structure](#file-structure)

---

## Overview

Visper is built on an Electron + Svelte 5 stack with TypeScript, targeting Windows desktop.

| Category | Technology | Version |
|----------|------------|---------|
| Desktop Framework | Electron | 33.x |
| UI Framework | Svelte | 5.x |
| Language | TypeScript | 5.x |
| Build Tool | Vite | 5.4.x |
| Database | SQLite (better-sqlite3) | 11.x |
| AI/ML | Google Generative AI SDK | 0.21.x |
| Packaging | electron-builder | 25.x |

---

## Runtime Dependencies

### @google/generative-ai (v0.21.0)

Google's official SDK for the Gemini API.

**Purpose:** Audio transcription using Gemini Flash model

**Usage in codebase:**
- `src/main/services/gemini.service.ts`
- Model: `gemini-2.0-flash-exp`
- Input: Base64-encoded WAV audio
- Output: Cleaned transcription text

**Key Features Used:**
- `GoogleGenerativeAI` class
- `getGenerativeModel()` method
- `generateContent()` with inline audio data
- System instruction for filler word removal

---

### better-sqlite3 (v11.0.0)

Synchronous SQLite3 bindings for Node.js.

**Purpose:** Local database for transcription history

**Usage in codebase:**
- `src/main/services/database.service.ts`
- Database location: `%APPDATA%/visper/visper.db`

**Key Features Used:**
- WAL journal mode for performance
- Prepared statements
- FTS5 full-text search
- Triggers for FTS synchronization

**Why better-sqlite3 over other options:**
- Synchronous API (simpler code)
- Native performance
- No promises needed for simple queries
- FTS5 support

---

### dotenv (v17.2.3)

Loads environment variables from `.env` file.

**Purpose:** Configuration management

**Usage in codebase:**
- `src/main/main.ts` - Loads at startup
- Provides `VITE_DEFAULT_GEMINI_KEY`

---

### electron-store (v10.0.0)

Simple data persistence for Electron apps.

**Purpose:** Store user settings

**Usage in codebase:**
- `src/main/services/settings.service.ts`
- Stores: theme, soundEnabled, firstLaunchComplete, hotkey

**Storage Location:** `%APPDATA%/visper/config.json`

**Why electron-store:**
- Simple key-value API
- Automatic JSON serialization
- Schema validation support
- Atomic writes

---

### node-global-key-listener (v0.3.0)

Global keyboard event listener for Node.js.

**Purpose:** Global hotkey registration (Win+J)

**Note:** Listed in package.json but NOT actually used in the current implementation. The code uses Electron's built-in `globalShortcut` API instead.

**Current Implementation:**
```typescript
// src/main/services/hotkey.service.ts
import { globalShortcut } from 'electron';
globalShortcut.register('Super+J', callback);
```

---

## Development Dependencies

### Electron & Build Tools

| Package | Version | Purpose |
|---------|---------|---------|
| electron | ^33.0.0 | Desktop runtime |
| electron-builder | ^25.0.0 | Application packaging |
| esbuild | ^0.27.2 | Preload script bundling |

### Svelte & Vite

| Package | Version | Purpose |
|---------|---------|---------|
| svelte | ^5.0.0 | UI framework |
| @sveltejs/vite-plugin-svelte | ^4.0.0 | Vite integration |
| vite | ^5.4.0 | Build tool & dev server |

### TypeScript

| Package | Version | Purpose |
|---------|---------|---------|
| typescript | ^5.0.0 | Type checking |
| @types/better-sqlite3 | ^7.6.8 | SQLite type definitions |
| @types/node | ^20.10.0 | Node.js type definitions |

### Utilities

| Package | Version | Purpose |
|---------|---------|---------|
| concurrently | ^9.0.0 | Run multiple scripts |
| wait-on | ^8.0.0 | Wait for port availability |

---

## Build Configuration

### Vite Configuration (`vite.config.ts`)

```typescript
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [svelte()],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/renderer/index.html')
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@renderer': resolve(__dirname, 'src/renderer')
    }
  },
  server: {
    port: 5173,
    strictPort: true
  }
});
```

### Svelte Configuration (`svelte.config.js`)

```javascript
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  compilerOptions: {
    runes: true  // Enable Svelte 5 Runes
  }
};
```

### TypeScript Configuration

**`tsconfig.json` (Renderer):**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["node"],
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@main/*": ["src/main/*"],
      "@renderer/*": ["src/renderer/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "release"]
}
```

**`tsconfig.node.json` (Main Process):**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "outDir": "dist/main",
    "rootDir": "src/main",
    "types": ["node"]
  },
  "include": ["src/main/**/*"],
  "exclude": ["node_modules"]
}
```

### Electron Builder Configuration (in package.json)

```json
{
  "build": {
    "appId": "com.visper.app",
    "productName": "Visper",
    "directories": {
      "output": "release"
    },
    "files": [
      "dist/**/*",
      "package.json",
      "!**/node_modules/**/MacKeyServer",
      "!**/node_modules/**/MacKeyServer.dSYM",
      "!**/node_modules/**/*.dylib"
    ],
    "extraResources": [
      {
        "from": "resources/icon.png",
        "to": "icon.png"
      }
    ],
    "win": {
      "target": ["nsis", "portable"],
      "icon": "build/icon.png",
      "signAndEditExecutable": false
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true
    },
    "portable": {
      "artifactName": "Visper-Portable.exe"
    }
  }
}
```

---

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_DEFAULT_GEMINI_KEY` | Default Gemini API key | `AIza...` |

### .env.example

```
VITE_DEFAULT_GEMINI_KEY=your_gemini_api_key_here
```

### Usage

The API key is loaded in the main process:
```typescript
// src/main/main.ts
import { config } from 'dotenv';
config();

// src/main/services/gemini.service.ts
const envKey = process.env.VITE_DEFAULT_GEMINI_KEY || null;
```

---

## File Structure

```
visper/
├── package.json              # Dependencies & scripts
├── package-lock.json         # Locked versions
├── vite.config.ts            # Vite configuration
├── svelte.config.js          # Svelte configuration
├── tsconfig.json             # TypeScript (renderer)
├── tsconfig.node.json        # TypeScript (main)
├── .env                      # Environment variables (gitignored)
├── .env.example              # Environment template
├── .gitignore
│
├── src/
│   ├── main/                 # Electron main process
│   │   ├── main.ts           # Entry point
│   │   ├── preload.ts        # Context bridge
│   │   └── services/         # Backend services
│   │       ├── window.service.ts
│   │       ├── tray.service.ts
│   │       ├── hotkey.service.ts
│   │       ├── gemini.service.ts
│   │       ├── database.service.ts
│   │       └── settings.service.ts
│   │
│   └── renderer/             # Svelte frontend
│       ├── index.html        # HTML template
│       ├── main.ts           # Svelte entry
│       ├── App.svelte        # Root component
│       ├── views/            # Page components
│       │   ├── Welcome.svelte
│       │   ├── Dictation.svelte
│       │   ├── History.svelte
│       │   └── Settings.svelte
│       ├── components/       # Reusable components
│       │   ├── layout/
│       │   │   ├── TitleBar.svelte
│       │   │   └── NavBar.svelte
│       │   ├── dictation/
│       │   │   ├── MicButton.svelte
│       │   │   ├── Timer.svelte
│       │   │   ├── Waveform.svelte
│       │   │   └── TranscriptBox.svelte
│       │   └── feedback/
│       │       └── Toast.svelte
│       ├── lib/              # Utilities
│       │   ├── audio-recorder.ts
│       │   ├── sounds.ts
│       │   └── formatters.ts
│       └── styles/
│           └── global.css
│
├── build/                    # Build assets
│   └── icon.png              # Windows app icon
│
├── resources/                # Packaged resources
│   └── icon.png              # Tray/taskbar icon
│
├── public/                   # Static assets
│   └── logo.png              # In-app logo
│
├── dist/                     # Compiled output (gitignored)
│   ├── main/                 # Compiled main process
│   └── renderer/             # Compiled renderer
│
├── release/                  # Packaged app (gitignored)
│   └── win-unpacked/         # Unpacked Windows build
│
└── Claude Docs/              # Documentation
    ├── plan.md               # Original project plan
    ├── architecture.md
    ├── database-schema.md
    ├── frontend-structure.md
    ├── key-flows.md
    ├── api-reference.md
    ├── tech-stack.md
    └── setup-and-development.md
```

---

## NPM Scripts

```json
{
  "scripts": {
    "dev": "npm run build:main && concurrently \"npm run dev:vite\" \"npm run dev:electron\"",
    "dev:vite": "vite",
    "dev:electron": "wait-on tcp:5173 && electron .",
    "build:main": "tsc -p tsconfig.node.json && npm run build:preload",
    "build:preload": "esbuild src/main/preload.ts --bundle --platform=node --outfile=dist/main/preload.js --external:electron --format=cjs",
    "build": "npm run build:main && vite build",
    "build:electron": "npm run build && electron-builder",
    "preview": "vite preview"
  }
}
```

### Script Descriptions

| Script | Purpose |
|--------|---------|
| `dev` | Full development mode (main + renderer) |
| `dev:vite` | Start Vite dev server only |
| `dev:electron` | Start Electron after Vite is ready |
| `build:main` | Compile main process TypeScript |
| `build:preload` | Bundle preload script with esbuild |
| `build` | Full production build |
| `build:electron` | Build + package for distribution |
| `preview` | Preview production build |
