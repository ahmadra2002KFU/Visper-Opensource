# Key Flows Documentation

**Last Updated**: 2026-01-08
**Based on**: Actual source code examination

---

## Table of Contents

1. [Application Startup](#application-startup)
2. [First Launch Flow](#first-launch-flow)
3. [Recording and Transcription](#recording-and-transcription)
4. [Global Hotkey Flow](#global-hotkey-flow)
5. [History Management](#history-management)
6. [Settings Management](#settings-management)
7. [Window Management](#window-management)
8. [Error Handling](#error-handling)

---

## Application Startup

### Main Process Initialization

```
app.requestSingleInstanceLock()
         |
         v
    [Lock acquired?]
         |
    No --+-- Yes
    |         |
    v         v
app.quit()   app.whenReady()
                   |
                   v
         +------------------+
         | Initialize Services |
         +------------------+
         | 1. SettingsService |
         | 2. DatabaseService |
         | 3. GeminiService   |
         +------------------+
                   |
                   v
         setupIpcHandlers()
                   |
                   v
         WindowService.createMainWindow()
                   |
                   v
         TrayService (system tray)
                   |
                   v
         HotkeyService.register()
                   |
                   v
         [App Ready]
```

**Code Path:**
```
src/main/main.ts
  -> new SettingsService()           // settings.service.ts
  -> new DatabaseService()           // database.service.ts
  -> new GeminiService(settings)     // gemini.service.ts
  -> setupIpcHandlers()              // main.ts (local function)
  -> new WindowService()             // window.service.ts
  -> windowService.createMainWindow()
  -> new TrayService(windowService)  // tray.service.ts
  -> new HotkeyService(windowService)// hotkey.service.ts
  -> hotkeyService.register()
```

### Renderer Process Initialization

```
index.html loads
         |
         v
main.ts executes
         |
         v
mount(App, { target: #app })
         |
         v
App.svelte onMount()
         |
         v
visperAPI.app.isFirstLaunch()
         |
    First Launch?
    |           |
   Yes         No
    |           |
    v           v
currentView   currentView
= 'welcome'   = 'dictation'
```

---

## First Launch Flow

### Welcome Screen Sequence

```
[Welcome.svelte mounted]
         |
         v
    User enters API key (optional)
         |
    +----+----+
    |         |
 No Key    Has Key
    |         |
    v         v
[Get Started] [Validate API Key]
    |              |
    v         +----+----+
onComplete()  |         |
    |       Valid     Invalid
    v         |         |
[Skip to    Save key   Show error
Dictation]    |         |
              v         v
        onComplete()  [Retry]
```

**Code Flow:**

1. `Welcome.svelte`: handleStart()
2. If API key provided:
   - `window.visperAPI.settings.testApi(apiKey)` -> IPC -> GeminiService.testConnection()
   - On success: `window.visperAPI.settings.setApiKey(apiKey)` -> IPC -> SettingsService.setApiKey()
3. Call `onComplete()` prop
4. `App.svelte`: completeSetup()
5. `window.visperAPI.app.completeSetup()` -> IPC -> SettingsService.completeSetup()
6. Set `currentView = 'dictation'`

---

## Recording and Transcription

### Complete Recording Flow

```
[User triggers recording]
(Click MicButton OR Win+J hotkey)
         |
         v
Dictation.handleToggle()
         |
    [recordingState?]
    |       |       |
  idle   recording processing
    |       |       |
    v       v       v
startRecording() stopRecording() [ignore]
         |
         v
AudioRecorder.start()
         |
         v
navigator.mediaDevices.getUserMedia()
         |
         v
MediaRecorder starts (WebM/Opus)
         |
         v
AnalyserNode for waveform data
         |
         v
setInterval(timer, 1000)
         |
         v
[Recording in progress...]
waveformData updates at 60fps
         |
    [User stops recording]
         |
         v
AudioRecorder.stop()
         |
         v
MediaRecorder.stop()
         |
         v
Blob chunks -> WebM Blob
         |
         v
convertToWav(webmBlob)
         |
         v
AudioContext.decodeAudioData()
         |
         v
encodeWav(channelData, 16000)
         |
         v
WAV ArrayBuffer
         |
         v
visperAPI.recording.sendAudioData(buffer)
         |
         v
IPC: 'recording:audio-data'
         |
         v
GeminiService.transcribe()
         |
         v
Base64 encode audio
         |
         v
Gemini API call with:
- model: 'gemini-2.0-flash-exp'
- systemInstruction: TRANSCRIPTION_PROMPT
- inlineData: { mimeType: 'audio/wav', data: base64 }
         |
         v
Response: cleaned transcription text
         |
         v
IPC Response: { success: true, text: "..." }
         |
         v
visperAPI.history.save(text, seconds)
         |
         v
DatabaseService.saveTranscription()
         |
         v
visperAPI.clipboard.copy(text)
         |
         v
Show toast: "Copied to clipboard!"
         |
         v
[Recording complete]
```

### Audio Configuration

**Capture Settings:**
```typescript
navigator.mediaDevices.getUserMedia({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 16000,
    channelCount: 1
  }
});
```

**WAV Output Format:**
- Sample Rate: 16000 Hz
- Channels: 1 (mono)
- Bits Per Sample: 16
- Format: PCM (Linear)

### Recording Limits

- **Minimum Duration**: 0.5 seconds (recordings shorter are auto-cancelled)
- **Warning**: At 2 minutes, shows toast notification
- **Maximum Duration**: 5 minutes (auto-stop)

---

## Global Hotkey Flow

### Hotkey Registration

```
HotkeyService.register()
         |
         v
globalShortcut.register('Super+J', callback)
         |
    [Registered?]
    |          |
   Yes        No
    |          |
    v          v
[Success]  Try fallback
           'Ctrl+Alt+J'
                |
           [Registered?]
           |          |
          Yes        No
           |          |
           v          v
       [Success]  [Log error]
```

### Hotkey Event Flow

```
[User presses Win+J]
         |
         v
globalShortcut callback
         |
         v
HotkeyService.handleHotkey()
         |
         v
    [Window visible?]
    |              |
   No             Yes
    |              |
    v              |
windowService.show()
    |              |
    v              v
windowService.sendToRenderer('hotkey:toggle-recording')
         |
         v
IPC: 'hotkey:toggle-recording' event
         |
         v
preload.ts: ipcRenderer.on('hotkey:toggle-recording', handler)
         |
         v
Dictation.svelte callback
         |
         v
handleToggle()
```

---

## History Management

### Loading History

```
History.svelte onMount()
         |
         v
loadHistory(reset=true)
         |
         v
    [searchQuery empty?]
    |                |
   Yes              No
    |                |
    v                v
visperAPI.history.get()  visperAPI.history.search()
         |                        |
         v                        v
IPC: 'history:get'       IPC: 'history:search'
         |                        |
         v                        v
DatabaseService          DatabaseService
.getTranscriptions()     .searchTranscriptions()
         |                        |
         v                        v
    SQL: SELECT with         SQL: FTS5 MATCH
    LIMIT/OFFSET             with pagination
         |                        |
         +----------+-------------+
                    |
                    v
         { items: [...], total: N }
                    |
                    v
         items = result.items
         total = result.total
         hasMore = items.length < total
                    |
                    v
         groupByDate(items) -> groupedItems
                    |
                    v
         [UI renders grouped list]
```

### Deleting Item

```
[User clicks delete button]
         |
         v
deleteItem(id)
         |
         v
visperAPI.history.delete(id)
         |
         v
IPC: 'history:delete'
         |
         v
DatabaseService.deleteTranscription(id)
         |
         v
SQL: DELETE FROM transcriptions WHERE id = ?
         |
         v
[Trigger: transcriptions_ad]
FTS index updated
         |
         v
IPC Response: true/false
         |
         v
items = items.filter(item => item.id !== id)
total--
         |
         v
showToast('Deleted', 'info')
```

---

## Settings Management

### Loading Settings

```
Settings.svelte onMount()
         |
         v
visperAPI.settings.get()
         |
         v
IPC: 'settings:get'
         |
         v
SettingsService.getAll()
         |
         v
electron-store.get() for each key
         |
         v
{ theme, soundEnabled, firstLaunchComplete, hotkey }
         |
         v
[Apply to component state]
         |
         v
visperAPI.settings.getApiKey()
         |
         v
IPC: 'settings:get-api-key'
         |
         v
SettingsService.getApiKey()
         |
         v
    [safeStorage available?]
    |                    |
   Yes                  No
    |                    |
    v                    v
Read & decrypt       Read plain text
from secure-key.enc  (fallback)
         |
         v
    [Key exists?]
    |         |
   Yes       No
    |         |
    v         v
hasCustomKey  hasCustomKey
= true        = false
apiKey =      apiKey = ''
'••••••...'
```

### Saving API Key

```
[User enters new key and clicks Save]
         |
         v
saveApiKey()
         |
         v
visperAPI.settings.setApiKey(apiKey)
         |
         v
IPC: 'settings:set-api-key'
         |
         v
SettingsService.setApiKey(key)
         |
         v
    [safeStorage available?]
    |                    |
   Yes                  No
    |                    |
    v                    v
safeStorage            Write plain text
.encryptString(key)    to file (fallback)
         |
         v
Write to secure-key.enc
         |
         v
IPC Response: { success: true }
         |
         v
hasCustomKey = true
apiKey = '••••••...' (masked)
showToast('API key saved', 'success')
```

### Theme Change

```
[User clicks theme button]
         |
         v
handleThemeChange(newTheme)
         |
         v
theme = newTheme
         |
         v
visperAPI.settings.set('theme', theme)
         |
         v
IPC: 'settings:set'
         |
         v
SettingsService.set('theme', value)
         |
         v
electron-store.set('theme', value)
         |
         v
[Apply theme to UI]
         |
    [theme value?]
    |         |        |
 'light'   'dark'  'system'
    |         |        |
    v         v        v
data-theme  data-theme  Check prefers-color-scheme
='light'    ='dark'     then apply 'light' or 'dark'
```

---

## Window Management

### Minimize to Tray

```
[User clicks minimize or close button]
         |
         v
window.visperAPI.window.minimize()
or window.visperAPI.window.close()
         |
         v
IPC: 'window:minimize' or 'window:close'
         |
         v
windowService.minimizeToTray()
         |
         v
mainWindow.hide()
         |
         v
[Window hidden, app continues in tray]
```

### Show Window

```
[System tray click or hotkey]
         |
         v
WindowService.show()
         |
         v
    [Window minimized?]
    |              |
   Yes            No
    |              |
    v              |
mainWindow.restore()
    |              |
    v              v
mainWindow.show()
         |
         v
mainWindow.focus()
```

### Toggle Visibility

```
WindowService.toggleVisibility()
         |
         v
    [Window visible?]
    |              |
   Yes            No
    |              |
    v              v
hide()          show()
```

---

## Error Handling

### Transcription Errors

```
GeminiService.transcribe()
         |
    [Error occurs]
         |
    +----+----+----+
    |    |    |    |
   API  Quota Rate  Other
   Key  Error Limit Error
    |    |    |    |
    v    v    v    v
'Invalid  'API   'Rate    'Transcription
API key'  quota  limit    failed: ...'
          exceeded' reached'
         |
         v
throw new Error(message)
         |
         v
IPC Response: { success: false, error: message }
         |
         v
Dictation.svelte catch block
         |
         v
showToast(error.message, 'error')
playSound('error')
recordingState = 'idle'
```

### Recording Errors

```
AudioRecorder.start()
         |
    [getUserMedia fails]
         |
         v
catch: console.error()
return false
         |
         v
Dictation.startRecording()
         |
    [started === false]
         |
         v
showToast('Could not access microphone', 'error')
```

### API Key Validation Errors

```
GeminiService.testConnection()
         |
    [Error occurs]
         |
         v
catch: { success: false, error: error.message }
         |
         v
IPC Response
         |
         v
Settings/Welcome component
         |
         v
showToast(result.error, 'error')
```
