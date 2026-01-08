# Frontend Structure Documentation

**Last Updated**: 2026-01-08
**Framework**: Svelte 5 with Runes

---

## Table of Contents

1. [Overview](#overview)
2. [Entry Points](#entry-points)
3. [Component Architecture](#component-architecture)
4. [Views](#views)
5. [Components](#components)
6. [Libraries](#libraries)
7. [Styling System](#styling-system)
8. [State Management](#state-management)

---

## Overview

The Visper frontend is built with Svelte 5, using the new Runes reactivity system (`$state`, `$derived`, `$props`). The UI is a single-page application with view-based navigation (not URL routing).

**Key Features:**
- Svelte 5 Runes for reactivity
- Component-based architecture
- CSS variables design system
- Frameless window with custom title bar
- Glass-morphism visual style

---

## Entry Points

### HTML Template: `src/renderer/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="...">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@200..800&display=swap" rel="stylesheet">
  <title>Visper</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

**Font:** Plus Jakarta Sans (variable weight 200-800)

### Application Entry: `src/renderer/main.ts`

```typescript
import { mount } from 'svelte';
import App from './App.svelte';
import './styles/global.css';

const app = mount(App, {
  target: document.getElementById('app')!
});

export default app;
```

---

## Component Architecture

### Root Component: `src/renderer/App.svelte`

**State Variables:**
```typescript
let currentView: View = $state('dictation');
let isFirstLaunch = $state(false);
let toasts: Array<{ id: number; message: string; type: 'success' | 'error' | 'info' }> = $state([]);
let toastId = 0;
```

**View Types:**
```typescript
type View = 'welcome' | 'dictation' | 'history' | 'settings';
```

**Navigation Function:**
```typescript
function navigate(view: View) {
  currentView = view;
}
```

**Toast System:**
```typescript
function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
  const id = toastId++;
  toasts = [...toasts, { id, message, type }];
  setTimeout(() => {
    toasts = toasts.filter(t => t.id !== id);
  }, 3000);
}
```

**Global Functions (for external access):**
```typescript
if (typeof window !== 'undefined') {
  (window as any).visperNavigate = navigate;
  (window as any).visperToast = showToast;
}
```

**Template Structure:**
```svelte
<div class="app">
  <TitleBar />
  <main class="content">
    {#if currentView === 'welcome'}
      <Welcome onComplete={completeSetup} />
    {:else if currentView === 'dictation'}
      <Dictation {navigate} {showToast} />
    {:else if currentView === 'history'}
      <History {navigate} {showToast} />
    {:else if currentView === 'settings'}
      <Settings {navigate} {showToast} />
    {/if}
  </main>
  <div class="toast-container">
    {#each toasts as toast (toast.id)}
      <Toast message={toast.message} type={toast.type} />
    {/each}
  </div>
</div>
```

---

## Views

### Welcome View: `src/renderer/views/Welcome.svelte`

First-launch onboarding screen.

**Props:**
```typescript
interface Props {
  onComplete: () => void;
}
```

**State:**
```typescript
let apiKey = $state('');
let isValidating = $state(false);
let error = $state('');
```

**Features:**
- App logo and tagline
- Feature highlights (Lightning Fast, Win+J Hotkey, History)
- Optional Gemini API key input
- "Get Started" button
- API key validation before completion

**Flow:**
1. User can enter custom API key (optional)
2. If API key provided, validates via `window.visperAPI.settings.testApi()`
3. If valid, saves key via `window.visperAPI.settings.setApiKey()`
4. Calls `onComplete()` to proceed to dictation view

---

### Dictation View: `src/renderer/views/Dictation.svelte`

Main recording interface.

**Props:**
```typescript
interface Props {
  navigate: (view: View) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}
```

**State:**
```typescript
let recordingState: RecordingState = $state('idle');
let seconds = $state(0);
let waveformData: number[] = $state([]);
let transcript = $state('');
let soundEnabled = $state(true);
```

**Recording States:**
- `idle` - Ready to record
- `recording` - Currently capturing audio
- `processing` - Sending to API and waiting for response

**Key Functions:**

1. `handleToggle()` - Main recording control logic
2. `startRecording()` - Initiates AudioRecorder
3. `stopRecording()` - Stops recording and sends to API
4. `copyAndClear()` - Copies transcript and clears display

**Recording Flow:**
```
1. onMount: Initialize AudioRecorder, subscribe to hotkey events
2. User triggers recording (click or hotkey)
3. Start timer interval (1 second)
4. Warning at 2 minutes, auto-stop at 5 minutes
5. On stop: Convert to WAV, send to API
6. On success: Save to history, copy to clipboard
```

**Hotkey Subscription:**
```typescript
unsubscribeHotkey = window.visperAPI.recording.onToggle(() => {
  handleToggle();
});
```

**Child Components:**
- MicButton (state indicator and trigger)
- Timer (elapsed time display)
- Waveform (audio visualization)
- TranscriptBox (result display)
- NavBar (navigation)

---

### History View: `src/renderer/views/History.svelte`

Transcription history browser.

**Props:**
```typescript
interface Props {
  navigate: (view: View) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}
```

**State:**
```typescript
let items: Transcription[] = $state([]);
let searchQuery = $state('');
let isLoading = $state(true);
let page = $state(1);
let hasMore = $state(false);
let total = $state(0);
const limit = 20;
```

**Derived State:**
```typescript
const groupedItems = $derived(groupByDate(items));
```

**Key Functions:**
- `loadHistory(reset)` - Fetches paginated history
- `handleSearch()` - Triggers search with current query
- `loadMore()` - Pagination (infinite scroll)
- `copyItem(text)` - Copy to clipboard
- `deleteItem(id)` - Remove transcription

**Features:**
- Search bar with clear button
- Items grouped by date (Today, Yesterday, etc.)
- Copy and delete actions per item
- Load more button for pagination
- Empty state illustration

---

### Settings View: `src/renderer/views/Settings.svelte`

Application configuration.

**Props:**
```typescript
interface Props {
  navigate: (view: View) => void;
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}
```

**State:**
```typescript
let apiKey = $state('');
let hasCustomKey = $state(false);
let theme = $state<'light' | 'dark' | 'system'>('light');
let soundEnabled = $state(true);
let isTesting = $state(false);
let isSaving = $state(false);
```

**Sections:**

1. **Gemini API Key**
   - Shows if using custom or default key
   - Password input for new key
   - Test and Save buttons
   - "Use default key instead" option

2. **Theme**
   - Light / Dark / System buttons
   - Updates `data-theme` attribute on document

3. **Sound Feedback**
   - Toggle switch
   - Enables/disables audio feedback

4. **Hotkey Display**
   - Shows Win+J (read-only)
   - Informational display

5. **Danger Zone**
   - Clear All History button (with confirm dialog)

6. **About**
   - Version number (v1.0.0)
   - "Powered by Gemini" credit

---

## Components

### Layout Components

#### TitleBar: `src/renderer/components/layout/TitleBar.svelte`

Custom window title bar (frameless window).

**Features:**
- Draggable region (CSS: `-webkit-app-region: drag`)
- App logo and name
- Minimize button
- Close button (minimizes to tray)

**Window Controls:**
```typescript
function minimize() {
  window.visperAPI.window.minimize();
}

function close() {
  window.visperAPI.window.close();
}
```

---

#### NavBar: `src/renderer/components/layout/NavBar.svelte`

Bottom navigation bar.

**Props:**
```typescript
interface Props {
  currentView: View;
  navigate: (view: View) => void;
}
```

**Navigation Items:**
- Microphone icon - Dictation view
- Clock icon - History view
- Gear icon - Settings view

**Active State:** Highlighted with accent color

---

### Dictation Components

#### MicButton: `src/renderer/components/dictation/MicButton.svelte`

Central recording button.

**Props:**
```typescript
interface Props {
  state: RecordingState;
  onClick: () => void;
  disabled?: boolean;
}
```

**Derived States:**
```typescript
const isRecording = $derived(state === 'recording');
const isProcessing = $derived(state === 'processing');
```

**Visual States:**
- Idle: Orange background, subtle shadow
- Recording: Red background, animated pulse rings (3), breathing animation
- Processing: Muted gray, spinner animation

**Animations:**
- `breathing` - Scale animation (1.0 to 1.03)
- `pulse-expand` - Expanding ring animation
- `spin` - Loading spinner rotation

---

#### Timer: `src/renderer/components/dictation/Timer.svelte`

Elapsed time display.

**Props:**
```typescript
interface Props {
  seconds: number;
  isRecording?: boolean;
}
```

**Format:** MM:SS (e.g., "02:35")

**Visual:**
- Recording state: Red color with blinking dot
- Idle state: Secondary text color

---

#### Waveform: `src/renderer/components/dictation/Waveform.svelte`

Audio visualization bars.

**Props:**
```typescript
interface Props {
  data: number[];
  isActive?: boolean;
}
```

**Configuration:**
- 24 bars
- Height based on frequency data (0.1 to 1.0)
- Animated bounce effect during recording

**Data Processing:**
```typescript
const bars = $derived(() => {
  if (!isActive || data.length === 0) {
    return Array(barCount).fill(0.1);
  }
  // Sample data to get barCount values
  const step = Math.floor(data.length / barCount);
  return Array(barCount).fill(0).map((_, i) => {
    const start = i * step;
    const slice = data.slice(start, start + step);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length || 0;
    return Math.max(0.1, Math.min(1, avg * 1.5));
  });
});
```

---

#### TranscriptBox: `src/renderer/components/dictation/TranscriptBox.svelte`

Transcription result display.

**Props:**
```typescript
interface Props {
  text: string;
  onCopy: () => void;
  isLoading?: boolean;
}
```

**States:**
- Loading: Bouncing dots animation
- Empty: Placeholder text
- Content: Scrollable text with copy button

**Copy Feedback:**
```typescript
let copied = $state(false);
async function handleCopy() {
  if (!text) return;
  onCopy();
  copied = true;
  setTimeout(() => { copied = false; }, 1500);
}
```

---

### Feedback Components

#### Toast: `src/renderer/components/feedback/Toast.svelte`

Notification toast.

**Props:**
```typescript
interface Props {
  message: string;
  type?: 'success' | 'error' | 'info';
}
```

**Icons:** SVG icons for each type (checkmark, X, info)

**Colors:**
- Success: Emerald (`--color-success`)
- Error: Rose (`--color-error`)
- Info: Coral (`--color-accent`)

---

## Libraries

### AudioRecorder: `src/renderer/lib/audio-recorder.ts`

Web Audio API recording utility.

**Types:**
```typescript
export type RecordingState = 'idle' | 'recording' | 'processing';

export interface AudioRecorderOptions {
  onDataAvailable?: (data: Blob) => void;
  onVolumeChange?: (volume: number) => void;
  onWaveformData?: (data: number[]) => void;
}
```

**Key Features:**
- MediaRecorder with `audio/webm;codecs=opus`
- Audio settings: 16kHz, mono, noise suppression, echo cancellation
- Real-time waveform data via AnalyserNode
- WebM to WAV conversion for Gemini API

**WAV Conversion:**
The `encodeWav()` method creates proper WAV header with:
- Sample rate: 16000 Hz
- Channels: 1 (mono)
- Bits per sample: 16
- Format: PCM

---

### Sound Feedback: `src/renderer/lib/sounds.ts`

Synthesized audio feedback.

**Sound Types:**
- `start` - Ascending click (880Hz)
- `stop` - Descending click (660Hz)
- `success` - Two-note chime (C6 -> E6)
- `error` - Low tone (330Hz)

**Implementation:** Web Audio API oscillators with gain envelope

---

### Formatters: `src/renderer/lib/formatters.ts`

Utility functions for formatting.

**Functions:**
- `formatTime(seconds)` - Returns "MM:SS"
- `formatRelativeDate(dateString)` - Returns "Today", "Yesterday", or formatted date
- `formatTime12h(dateString)` - Returns "HH:MM AM/PM"
- `truncate(text, maxLength)` - Truncates with ellipsis
- `groupByDate(items)` - Groups items by relative date

---

## Styling System

### Design Tokens: `src/renderer/styles/global.css`

**Color Palette (Light Theme):**
```css
--color-primary: #1e293b;        /* Deep Slate Blue */
--color-accent: #f97316;         /* Vivid Coral */
--color-accent-hover: #ea580c;   /* Darker Coral */
--color-recording: #ef4444;      /* Crimson Red */
--color-success: #10b981;        /* Emerald */
--color-error: #f43f5e;          /* Rose */
--color-bg-primary: #fafaf9;     /* Warm Stone */
--color-bg-secondary: #f5f5f4;
--color-bg-tertiary: #e7e5e4;
--color-bg-glass: rgba(255, 255, 255, 0.65);
```

**Dark Theme:**
```css
[data-theme="dark"] {
  --color-accent: #fbbf24;       /* Warm Amber */
  --color-bg-primary: #0c0a09;   /* Near Black */
  --color-bg-glass: rgba(28, 25, 23, 0.75);
}
```

**Typography:**
```css
--font-sans: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-size-xs: 0.75rem;
--font-size-sm: 0.875rem;
--font-size-base: 1rem;
--font-size-lg: 1.125rem;
--font-size-xl: 1.25rem;
--font-size-2xl: 1.5rem;
```

**Spacing:**
```css
--spacing-xs: 0.25rem;
--spacing-sm: 0.5rem;
--spacing-md: 1rem;
--spacing-lg: 1.5rem;
--spacing-xl: 2rem;
```

**Border Radius:**
```css
--radius-sm: 0.375rem;
--radius-md: 0.5rem;
--radius-lg: 0.75rem;
--radius-xl: 1rem;
--radius-2xl: 1.5rem;
--radius-full: 9999px;
```

**Glass Effect (App Container):**
```css
#app {
  background: var(--color-bg-glass);
  backdrop-filter: blur(32px) saturate(180%);
  border-radius: var(--radius-2xl);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-xl);
}
```

**Animations:**
- `pulse` - Breathing effect
- `spin` - 360 rotation
- `fadeIn` - Fade + slide up
- `slideUp` - Slide from bottom
- `recording-pulse` - Recording indicator glow

**Accessibility:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## State Management

Visper uses Svelte 5 Runes for state management without external libraries.

**Pattern:**
- Local component state with `$state()`
- Computed values with `$derived()`
- Props with `$props()`
- Event handlers passed as props

**Example:**
```typescript
// Parent passes handlers
<Dictation {navigate} {showToast} />

// Child receives via $props()
let { navigate, showToast }: Props = $props();

// Local state
let recordingState: RecordingState = $state('idle');

// Derived state
const isRecording = $derived(state === 'recording');
```

**Cross-Component Communication:**
- Props drilling for navigation and toast functions
- IPC listeners for hotkey events
- Window globals for external access (`window.visperNavigate`, `window.visperToast`)
