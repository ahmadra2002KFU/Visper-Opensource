# Visper

**Your voice, transcribed.**

A fast, lightweight voice-to-text dictation app powered by Google's Gemini 3.0 Flash API. Built with Tauri 2.0, Rust, and Svelte 5.

![Visper Screenshot](docs/screenshot.png)

## Features

- **Lightning Fast** - Under 3 seconds from speech to text
- **Global Hotkey** - Press `Win+J` to start dictating from anywhere
- **Auto-Copy** - Transcriptions automatically copied to clipboard
- **History** - All transcriptions saved locally with full-text search
- **Privacy First** - Your data stays on your device
- **Lightweight** - ~3MB installer, minimal resource usage

## Installation

### Windows

Download the latest installer from [Releases](https://github.com/ahmadra2002KFU/Visper-Opensource/releases):
- `Visper_x.x.x_x64-setup.exe` (NSIS installer)
- `Visper_x.x.x_x64_en-US.msi` (MSI installer)

### Build from Source

#### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (latest stable)
- [Tauri CLI](https://tauri.app/v1/guides/getting-started/prerequisites)

#### Steps

```bash
# Clone the repository
git clone https://github.com/ahmadra2002KFU/Visper-Opensource.git
cd Visper-Opensource

# Install dependencies
npm install

# Run in development mode
npm run tauri:dev

# Build for production
npm run tauri:build
```

## Getting Your API Key

1. Visit [Google AI Studio](https://aistudio.google.com/apikey)
2. Create a new API key
3. Enter it in Visper's Welcome screen or Settings

## Tech Stack

- **Frontend**: Svelte 5 with TypeScript
- **Backend**: Rust with Tauri 2.0
- **Database**: SQLite with FTS5 full-text search
- **API**: Google Gemini 3.0 Flash
- **Audio**: Web Audio API with real-time waveform visualization

## Architecture

```
src/
├── renderer/           # Svelte frontend
│   ├── components/     # Reusable UI components
│   ├── views/          # Page components
│   ├── lib/            # Utilities and API
│   └── styles/         # Global CSS
└── src-tauri/          # Rust backend
    ├── src/
    │   ├── main.rs     # App entry point
    │   └── services/   # Core services
    └── tauri.conf.json # Tauri configuration
```

## License

Open Source - MIT License

## Author

Built by [Ahmed Rabaiah](https://www.linkedin.com/in/ahmed-rabaiah-a12943259/)

---

*Powered by Gemini*
