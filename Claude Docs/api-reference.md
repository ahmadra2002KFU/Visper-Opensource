# API Reference Documentation

**Last Updated**: 2026-01-08
**Based on**: Actual source code examination

---

## Table of Contents

1. [Preload API (visperAPI)](#preload-api-visperapi)
2. [IPC Channels](#ipc-channels)
3. [Service APIs](#service-apis)
4. [External APIs](#external-apis)
5. [Type Definitions](#type-definitions)

---

## Preload API (visperAPI)

The preload script exposes a secure API to the renderer process via `window.visperAPI`.

**Source File:** `src/main/preload.ts`

### recording

Audio recording operations.

#### `sendAudioData(audioBuffer: ArrayBuffer)`

Sends recorded audio for transcription.

**Parameters:**
- `audioBuffer` - WAV audio data as ArrayBuffer

**Returns:** `Promise<{ success: boolean; text?: string; error?: string }>`

**Example:**
```typescript
const result = await window.visperAPI.recording.sendAudioData(wavBuffer);
if (result.success) {
  console.log('Transcription:', result.text);
} else {
  console.error('Error:', result.error);
}
```

#### `onToggle(callback: () => void)`

Subscribes to hotkey toggle events from the main process.

**Parameters:**
- `callback` - Function called when Win+J is pressed

**Returns:** `() => void` - Unsubscribe function

**Example:**
```typescript
const unsubscribe = window.visperAPI.recording.onToggle(() => {
  handleRecordingToggle();
});

// Later, to unsubscribe:
unsubscribe();
```

---

### history

Transcription history operations.

#### `get(page: number, limit: number)`

Retrieves paginated transcription history.

**Parameters:**
- `page` - Page number (1-indexed)
- `limit` - Number of items per page

**Returns:** `Promise<{ items: Transcription[]; total: number }>`

**Example:**
```typescript
const { items, total } = await window.visperAPI.history.get(1, 20);
```

#### `search(query: string, page: number, limit: number)`

Searches transcriptions using full-text search.

**Parameters:**
- `query` - FTS5 search query
- `page` - Page number (1-indexed)
- `limit` - Number of items per page

**Returns:** `Promise<{ items: Transcription[]; total: number }>`

**Example:**
```typescript
const { items, total } = await window.visperAPI.history.search('meeting', 1, 20);
```

#### `delete(id: number)`

Deletes a transcription by ID.

**Parameters:**
- `id` - Transcription ID

**Returns:** `Promise<boolean>` - True if deleted successfully

**Example:**
```typescript
const deleted = await window.visperAPI.history.delete(123);
```

#### `save(text: string, durationSeconds: number)`

Saves a new transcription.

**Parameters:**
- `text` - Transcription text
- `durationSeconds` - Recording duration in seconds

**Returns:** `Promise<number>` - New record ID

**Example:**
```typescript
const newId = await window.visperAPI.history.save('Hello world', 5.2);
```

---

### settings

Application settings operations.

#### `get()`

Retrieves all settings.

**Returns:** `Promise<Settings>`

**Example:**
```typescript
const settings = await window.visperAPI.settings.get();
console.log('Theme:', settings.theme);
console.log('Sound enabled:', settings.soundEnabled);
```

#### `set(key: string, value: any)`

Updates a setting value.

**Parameters:**
- `key` - Setting key ('theme' | 'soundEnabled' | 'firstLaunchComplete' | 'hotkey')
- `value` - New value

**Returns:** `Promise<void>`

**Example:**
```typescript
await window.visperAPI.settings.set('theme', 'dark');
await window.visperAPI.settings.set('soundEnabled', false);
```

#### `getApiKey()`

Retrieves the stored API key.

**Returns:** `Promise<string | null>`

**Example:**
```typescript
const apiKey = await window.visperAPI.settings.getApiKey();
const hasCustomKey = apiKey !== null;
```

#### `setApiKey(key: string)`

Saves an encrypted API key.

**Parameters:**
- `key` - Gemini API key

**Returns:** `Promise<{ success: boolean; error?: string }>`

**Example:**
```typescript
const result = await window.visperAPI.settings.setApiKey('AIza...');
if (!result.success) {
  console.error('Failed:', result.error);
}
```

#### `testApi(key?: string)`

Tests API key validity by making a simple API call.

**Parameters:**
- `key` - Optional API key to test (uses stored key if not provided)

**Returns:** `Promise<{ success: boolean; error?: string }>`

**Example:**
```typescript
const result = await window.visperAPI.settings.testApi('AIza...');
if (result.success) {
  console.log('API key is valid');
}
```

---

### clipboard

Clipboard operations.

#### `copy(text: string)`

Copies text to the system clipboard.

**Parameters:**
- `text` - Text to copy

**Returns:** `Promise<boolean>` - Always returns true

**Example:**
```typescript
await window.visperAPI.clipboard.copy('Hello world');
```

---

### window

Window management operations.

#### `minimize()`

Minimizes the window to the system tray.

**Returns:** `void`

**Example:**
```typescript
window.visperAPI.window.minimize();
```

#### `close()`

Closes the window (minimizes to tray, does not quit app).

**Returns:** `void`

**Example:**
```typescript
window.visperAPI.window.close();
```

---

### app

Application lifecycle operations.

#### `isFirstLaunch()`

Checks if this is the first app launch.

**Returns:** `Promise<boolean>`

**Example:**
```typescript
const isFirst = await window.visperAPI.app.isFirstLaunch();
if (isFirst) {
  // Show welcome screen
}
```

#### `completeSetup()`

Marks the first-launch setup as complete.

**Returns:** `Promise<void>`

**Example:**
```typescript
await window.visperAPI.app.completeSetup();
```

---

## IPC Channels

### Main Process Handlers

| Channel | Handler | Parameters | Return Value |
|---------|---------|------------|--------------|
| `recording:audio-data` | invoke | `audioBuffer: ArrayBuffer` | `{ success, text?, error? }` |
| `history:get` | invoke | `page: number, limit: number` | `{ items[], total }` |
| `history:search` | invoke | `query: string, page: number, limit: number` | `{ items[], total }` |
| `history:delete` | invoke | `id: number` | `boolean` |
| `history:save` | invoke | `text: string, durationSeconds: number` | `number` |
| `settings:get` | invoke | none | `Settings` |
| `settings:set` | invoke | `key: string, value: any` | `void` |
| `settings:get-api-key` | invoke | none | `string \| null` |
| `settings:set-api-key` | invoke | `key: string` | `{ success, error? }` |
| `settings:test-api` | invoke | `key?: string` | `{ success, error? }` |
| `clipboard:copy` | invoke | `text: string` | `boolean` |
| `window:minimize` | on | none | `void` |
| `window:close` | on | none | `void` |
| `app:is-first-launch` | invoke | none | `boolean` |
| `app:complete-setup` | invoke | none | `void` |

### Main to Renderer Events

| Channel | Purpose | Parameters |
|---------|---------|------------|
| `hotkey:toggle-recording` | Global hotkey pressed | none |
| `navigate` | Navigate to view (tray menu) | `view: string` |

---

## Service APIs

### GeminiService

**Source File:** `src/main/services/gemini.service.ts`

#### `transcribe(audioBuffer: ArrayBuffer): Promise<string>`

Transcribes audio using Gemini API.

**Implementation Details:**
- Converts ArrayBuffer to base64
- Uses model: `gemini-2.0-flash-exp`
- Applies filler word removal prompt
- Returns cleaned transcription or `[inaudible]`

**Error Handling:**
- Invalid API key: `'Invalid API key. Please check your settings.'`
- Quota exceeded: `'API quota exceeded. Please try again later.'`
- Rate limit: `'Rate limit reached. Please wait a moment.'`
- Other: `'Transcription failed: [error message]'`

#### `testConnection(apiKey?: string): Promise<{ success: boolean; error?: string }>`

Tests API connectivity with a simple prompt.

### DatabaseService

**Source File:** `src/main/services/database.service.ts`

#### `saveTranscription(text: string, durationSeconds?: number, tokensUsed?: number): number`

Returns the new record ID.

#### `getTranscriptions(page?: number, limit?: number): { items: Transcription[]; total: number }`

Default: page=1, limit=20

#### `searchTranscriptions(query: string, page?: number, limit?: number): { items: Transcription[]; total: number }`

Uses FTS5 MATCH syntax.

#### `deleteTranscription(id: number): boolean`

Returns true if deleted.

#### `toggleFavorite(id: number): boolean`

Returns true if updated.

#### `clearHistory(): void`

Deletes all transcriptions.

#### `getStats(): { totalTranscriptions: number; totalDuration: number }`

Returns aggregate statistics.

### SettingsService

**Source File:** `src/main/services/settings.service.ts`

#### `getAll(): Settings`

Returns current settings object.

#### `get<K extends keyof Settings>(key: K): Settings[K]`

Returns specific setting value.

#### `set<K extends keyof Settings>(key: K, value: Settings[K]): void`

Updates setting value.

#### `getApiKey(): Promise<string | null>`

Returns decrypted API key or null.

#### `setApiKey(apiKey: string): Promise<void>`

Encrypts and saves API key.

#### `clearApiKey(): Promise<void>`

Removes stored API key.

#### `isFirstLaunch(): boolean`

Returns true if setup not completed.

#### `completeSetup(): void`

Sets firstLaunchComplete to true.

#### `reset(): void`

Clears all settings and API key.

---

## External APIs

### Google Generative AI (Gemini)

**Package:** `@google/generative-ai` v0.21.0

**Model Used:** `gemini-2.0-flash-exp`

**Audio Input Format:**
```typescript
{
  inlineData: {
    mimeType: 'audio/wav',
    data: base64EncodedAudio
  }
}
```

**System Instruction:**
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

**API Call Example:**
```typescript
const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash-exp',
  systemInstruction: TRANSCRIPTION_PROMPT
});

const result = await model.generateContent([
  {
    inlineData: {
      mimeType: 'audio/wav',
      data: base64Audio
    }
  },
  { text: 'Transcribe this audio.' }
]);

const response = await result.response;
const text = response.text().trim();
```

---

## Type Definitions

### Transcription

```typescript
interface Transcription {
  id: number;
  text: string;
  duration_seconds: number | null;
  tokens_used: number | null;
  created_at: string;
  is_favorite: number;
}
```

### Settings

```typescript
interface Settings {
  theme: 'light' | 'dark' | 'system';
  soundEnabled: boolean;
  firstLaunchComplete: boolean;
  hotkey: string;
}
```

### RecordingState

```typescript
type RecordingState = 'idle' | 'recording' | 'processing';
```

### AudioRecorderOptions

```typescript
interface AudioRecorderOptions {
  onDataAvailable?: (data: Blob) => void;
  onVolumeChange?: (volume: number) => void;
  onWaveformData?: (data: number[]) => void;
}
```

### VisperAPI (Complete Interface)

```typescript
interface VisperAPI {
  recording: {
    sendAudioData: (audioBuffer: ArrayBuffer) => Promise<{
      success: boolean;
      text?: string;
      error?: string;
    }>;
    onToggle: (callback: () => void) => () => void;
  };
  history: {
    get: (page: number, limit: number) => Promise<{
      items: Transcription[];
      total: number;
    }>;
    search: (query: string, page: number, limit: number) => Promise<{
      items: Transcription[];
      total: number;
    }>;
    delete: (id: number) => Promise<boolean>;
    save: (text: string, durationSeconds: number) => Promise<number>;
  };
  settings: {
    get: () => Promise<Settings>;
    set: (key: string, value: any) => Promise<void>;
    getApiKey: () => Promise<string | null>;
    setApiKey: (key: string) => Promise<{ success: boolean; error?: string }>;
    testApi: (key?: string) => Promise<{ success: boolean; error?: string }>;
  };
  clipboard: {
    copy: (text: string) => Promise<boolean>;
  };
  window: {
    minimize: () => void;
    close: () => void;
  };
  app: {
    isFirstLaunch: () => Promise<boolean>;
    completeSetup: () => Promise<void>;
  };
}

declare global {
  interface Window {
    visperAPI: VisperAPI;
  }
}
```
