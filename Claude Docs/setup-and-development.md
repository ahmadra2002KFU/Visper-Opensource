# Setup and Development Guide

**Last Updated**: 2026-01-08
**Based on**: Actual source code and package.json examination

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Development](#development)
5. [Building](#building)
6. [Project Structure](#project-structure)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18.x or later | Runtime |
| npm | 9.x or later | Package manager |
| Git | Any recent | Version control |
| Windows | 10/11 | Target platform |

### Optional

| Software | Purpose |
|----------|---------|
| Visual Studio Code | Recommended IDE |
| Svelte for VS Code | Syntax highlighting |

### System Requirements

- Windows 10 or Windows 11
- Microphone access (for recording)
- Internet connection (for Gemini API)

---

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/visper.git
cd visper
```

### 2. Install Dependencies

```bash
npm install
```

**Note:** better-sqlite3 requires native compilation. If you encounter errors:

```bash
# Install Windows build tools if needed
npm install -g windows-build-tools

# Or install Visual Studio Build Tools manually
```

### 3. Create Environment File

```bash
# Copy example file
copy .env.example .env

# Edit .env and add your Gemini API key
```

**.env contents:**
```
VITE_DEFAULT_GEMINI_KEY=your_gemini_api_key_here
```

### 4. Get a Gemini API Key

1. Go to [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Create a new API key
4. Copy the key to your `.env` file

---

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_DEFAULT_GEMINI_KEY` | Yes | Default Gemini API key for transcription |

### Settings (Runtime)

These settings are configurable in the app:

| Setting | Default | Description |
|---------|---------|-------------|
| theme | 'light' | 'light', 'dark', or 'system' |
| soundEnabled | true | Audio feedback for recording |
| hotkey | 'Super+J' | Global shortcut (display only) |

### Build Configuration

Electron Builder settings are in `package.json` under the `build` key:

```json
{
  "build": {
    "appId": "com.visper.app",
    "productName": "Visper",
    "win": {
      "target": ["nsis", "portable"]
    }
  }
}
```

---

## Development

### Start Development Server

```bash
npm run dev
```

This command:
1. Compiles the main process TypeScript (`npm run build:main`)
2. Starts Vite dev server on port 5173 (`npm run dev:vite`)
3. Waits for Vite, then starts Electron (`npm run dev:electron`)

**What happens:**
- Renderer loads from `http://localhost:5173`
- Main process runs from `dist/main/main.js`
- Hot Module Replacement (HMR) enabled for Svelte
- DevTools opens automatically

### Development Workflow

1. **Edit Svelte components** - Changes reflect immediately (HMR)
2. **Edit main process** - Restart the dev server
3. **Edit preload script** - Run `npm run build:preload` then restart

### Available Scripts

```bash
# Full development mode
npm run dev

# Start Vite only (no Electron)
npm run dev:vite

# Build main process only
npm run build:main

# Build preload script only
npm run build:preload

# Full production build
npm run build

# Build and package for Windows
npm run build:electron

# Preview production build
npm run preview
```

### File Watching

| Files | Watched By | Reload Method |
|-------|------------|---------------|
| `src/renderer/**/*` | Vite | HMR |
| `src/main/**/*` | Manual | Restart dev |
| `src/main/preload.ts` | Manual | Run build:preload + restart |

### Debugging

**Main Process:**
- Console logs appear in terminal
- Use `console.log()` in services

**Renderer Process:**
- DevTools opens automatically in dev mode
- Use browser console and debugger
- React DevTools equivalent not needed (Svelte)

**IPC Debugging:**
```typescript
// Add to main.ts for IPC logging
ipcMain.on('*', (event, channel, ...args) => {
  console.log('IPC:', channel, args);
});
```

---

## Building

### Development Build

```bash
npm run build
```

Creates:
- `dist/main/` - Compiled main process
- `dist/renderer/` - Bundled renderer

### Production Build (Packaged)

```bash
npm run build:electron
```

Creates in `release/`:
- `Visper Setup X.X.X.exe` - NSIS installer
- `Visper-Portable.exe` - Portable executable
- `win-unpacked/` - Unpacked application

### Build Output

```
release/
├── Visper Setup 1.0.0.exe      # Windows installer
├── Visper-Portable.exe         # Portable version
└── win-unpacked/               # Unpacked files
    ├── Visper.exe              # Main executable
    ├── resources/
    │   ├── app.asar            # Bundled app code
    │   ├── app.asar.unpacked/  # Native modules
    │   └── icon.png            # App icon
    └── ...                     # Electron runtime
```

### Build Configuration

**NSIS Installer Options:**
- Not one-click (shows dialog)
- Allows changing install directory
- Creates Start Menu shortcut

**Portable Version:**
- Single executable
- No installation required
- Settings stored in app directory

---

## Project Structure

```
visper/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── main.ts           # Entry point, IPC handlers
│   │   ├── preload.ts        # Context bridge (window.visperAPI)
│   │   └── services/         # Backend services
│   │       ├── window.service.ts    # Window management
│   │       ├── tray.service.ts      # System tray
│   │       ├── hotkey.service.ts    # Global shortcuts
│   │       ├── gemini.service.ts    # AI transcription
│   │       ├── database.service.ts  # SQLite operations
│   │       └── settings.service.ts  # Settings + encryption
│   │
│   └── renderer/             # Svelte frontend
│       ├── index.html        # HTML template
│       ├── main.ts           # Svelte mount point
│       ├── App.svelte        # Root component
│       ├── views/            # Page components
│       ├── components/       # Reusable UI components
│       ├── lib/              # Utilities
│       └── styles/           # Global CSS
│
├── build/                    # Build-time assets
│   └── icon.png              # App icon for packaging
│
├── resources/                # Runtime resources
│   └── icon.png              # Tray icon
│
├── public/                   # Static files (copied to dist)
│   └── logo.png              # In-app logo
│
├── Claude Docs/              # Documentation
│
├── dist/                     # Build output (gitignored)
├── release/                  # Packaged app (gitignored)
└── node_modules/             # Dependencies (gitignored)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/main/main.ts` | App entry, lifecycle, IPC handlers |
| `src/main/preload.ts` | Secure bridge between main/renderer |
| `src/renderer/App.svelte` | Root UI component |
| `src/renderer/views/Dictation.svelte` | Main recording interface |
| `src/renderer/lib/audio-recorder.ts` | Web Audio recording |
| `package.json` | Dependencies, scripts, build config |
| `vite.config.ts` | Vite bundler configuration |
| `tsconfig.json` | TypeScript (renderer) |
| `tsconfig.node.json` | TypeScript (main process) |

---

## Troubleshooting

### Common Issues

#### better-sqlite3 Build Errors

**Symptom:** Native module compilation fails during `npm install`

**Solution:**
```bash
# Install Windows Build Tools
npm install -g windows-build-tools

# Or manually install Visual Studio Build Tools with:
# - "Desktop development with C++" workload

# Then reinstall
rm -rf node_modules
npm install
```

#### Port 5173 Already in Use

**Symptom:** Vite fails to start

**Solution:**
```bash
# Find and kill process using port 5173
netstat -ano | findstr :5173
taskkill /PID <pid> /F

# Or change port in vite.config.ts
server: {
  port: 5174,  // Different port
  strictPort: true
}
```

#### Electron Not Starting

**Symptom:** App window doesn't appear

**Check:**
1. Is Vite running on port 5173?
2. Check terminal for errors
3. Try `npm run build:main` then `electron .`

#### API Key Not Working

**Symptom:** "Invalid API key" error

**Check:**
1. `.env` file exists in project root
2. Key format: `VITE_DEFAULT_GEMINI_KEY=AIza...`
3. No quotes around the key
4. Restart dev server after changing .env

#### Microphone Not Working

**Symptom:** "Could not access microphone" error

**Check:**
1. Windows microphone permissions for app
2. Default microphone set in Windows
3. Microphone not in use by other app

#### Hotkey Not Registering

**Symptom:** Win+J doesn't work

**Check:**
1. Another app may have registered Win+J
2. Fallback Ctrl+Alt+J should work
3. Check terminal for "Hotkey ... registered" message

### Debug Commands

```bash
# Check Node version
node --version

# Check npm version
npm --version

# Verify dependencies installed
npm ls

# Clean install
rm -rf node_modules
rm package-lock.json
npm install

# Rebuild native modules
npm rebuild better-sqlite3

# Check for port conflicts
netstat -ano | findstr :5173
```

### Log Locations

| Log Type | Location |
|----------|----------|
| Console output | Terminal running `npm run dev` |
| Renderer logs | Browser DevTools console |
| Database | `%APPDATA%\visper\visper.db` |
| Settings | `%APPDATA%\visper\config.json` |
| Encrypted key | `%APPDATA%\visper\secure-key.enc` |

### Clearing App Data

To reset the app completely:

```bash
# Windows
rmdir /s /q "%APPDATA%\visper"
```

This removes:
- Database (transcription history)
- Settings
- Encrypted API key

---

## Development Tips

### Svelte 5 Runes

This project uses Svelte 5 with Runes enabled:

```typescript
// State
let count = $state(0);

// Derived
const doubled = $derived(count * 2);

// Props
let { name, age = 18 }: Props = $props();
```

### Adding New IPC Channels

1. Add handler in `src/main/main.ts`:
```typescript
ipcMain.handle('channel:name', async (_event, arg) => {
  // Implementation
  return result;
});
```

2. Expose in `src/main/preload.ts`:
```typescript
contextBridge.exposeInMainWorld('visperAPI', {
  // ...existing...
  newFeature: {
    method: (arg) => ipcRenderer.invoke('channel:name', arg)
  }
});
```

3. Update types in preload.ts:
```typescript
export interface VisperAPI {
  // ...existing...
  newFeature: {
    method: (arg: string) => Promise<Result>;
  };
}
```

### Adding New Services

1. Create `src/main/services/feature.service.ts`
2. Import in `src/main/main.ts`
3. Initialize in `app.whenReady()` callback
4. Add IPC handlers as needed

### Adding New Views

1. Create `src/renderer/views/NewView.svelte`
2. Add to `View` type in `App.svelte`
3. Add conditional rendering in template
4. Update navigation as needed
