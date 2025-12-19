import { app, BrowserWindow, ipcMain, clipboard, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load environment variables from .env file
config();
import { WindowService } from './services/window.service.js';
import { TrayService } from './services/tray.service.js';
import { HotkeyService } from './services/hotkey.service.js';
import { DatabaseService } from './services/database.service.js';
import { GeminiService } from './services/gemini.service.js';
import { SettingsService } from './services/settings.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Services
let windowService: WindowService;
let trayService: TrayService;
let hotkeyService: HotkeyService;
let databaseService: DatabaseService;
let geminiService: GeminiService;
let settingsService: SettingsService;

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (windowService?.mainWindow) {
    if (windowService.mainWindow.isMinimized()) {
      windowService.mainWindow.restore();
    }
    windowService.mainWindow.show();
    windowService.mainWindow.focus();
  }
});

// Initialize app
app.whenReady().then(async () => {
  try {
    // Initialize services first
    settingsService = new SettingsService();
    databaseService = new DatabaseService();
    geminiService = new GeminiService(settingsService);
  } catch (error) {
    console.error('Failed to initialize services:', error);
  }

  // Setup IPC handlers BEFORE creating window - ALWAYS register even if services fail
  setupIpcHandlers();
  console.log('IPC handlers registered');

  // Initialize window
  windowService = new WindowService();
  await windowService.createMainWindow();

  // Initialize tray
  trayService = new TrayService(windowService);

  // Initialize hotkey
  hotkeyService = new HotkeyService(windowService);
  hotkeyService.register();
});

// Setup IPC handlers
function setupIpcHandlers() {
  // Recording
  ipcMain.handle('recording:audio-data', async (_event, audioBuffer: ArrayBuffer) => {
    try {
      if (!geminiService) return { success: false, error: 'Service not ready' };
      const result = await geminiService.transcribe(audioBuffer);
      return { success: true, text: result };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  });

  // History
  ipcMain.handle('history:get', async (_event, page: number, limit: number) => {
    if (!databaseService) return { items: [], total: 0 };
    return databaseService.getTranscriptions(page, limit);
  });

  ipcMain.handle('history:search', async (_event, query: string, page: number, limit: number) => {
    if (!databaseService) return { items: [], total: 0 };
    return databaseService.searchTranscriptions(query, page, limit);
  });

  ipcMain.handle('history:delete', async (_event, id: number) => {
    if (!databaseService) return false;
    return databaseService.deleteTranscription(id);
  });

  ipcMain.handle('history:save', async (_event, text: string, durationSeconds: number) => {
    if (!databaseService) return -1;
    return databaseService.saveTranscription(text, durationSeconds);
  });

  // Settings
  ipcMain.handle('settings:get', async () => {
    if (!settingsService) return { theme: 'light', soundEnabled: true };
    return settingsService.getAll();
  });

  ipcMain.handle('settings:set', async (_event, key: string, value: any) => {
    if (!settingsService) return;
    return settingsService.set(key as any, value);
  });

  ipcMain.handle('settings:get-api-key', async () => {
    if (!settingsService) return null;
    return settingsService.getApiKey();
  });

  ipcMain.handle('settings:set-api-key', async (_event, key: string) => {
    try {
      if (!settingsService) return { success: false, error: 'Service not ready' };
      await settingsService.setApiKey(key);
      return { success: true };
    } catch (error) {
      console.error('Failed to save API key:', error);
      return { success: false, error: (error as Error).message };
    }
  });

  ipcMain.handle('settings:test-api', async (_event, key?: string) => {
    if (!geminiService) return { success: false, error: 'Service not ready' };
    return geminiService.testConnection(key);
  });

  // Clipboard
  ipcMain.handle('clipboard:copy', async (_event, text: string) => {
    clipboard.writeText(text);
    return true;
  });

  // Window
  ipcMain.on('window:minimize', () => {
    windowService?.minimizeToTray();
  });

  ipcMain.on('window:close', () => {
    windowService?.minimizeToTray();
  });

  // Check first launch
  ipcMain.handle('app:is-first-launch', async () => {
    if (!settingsService) return true;
    return settingsService.isFirstLaunch();
  });

  ipcMain.handle('app:complete-setup', async () => {
    if (!settingsService) return;
    return settingsService.completeSetup();
  });
}

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, keep app running in menu bar
  if (process.platform !== 'darwin') {
    // Don't quit - minimize to tray instead
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    windowService.createMainWindow();
  }
});

app.on('before-quit', () => {
  hotkeyService?.unregister();
  trayService?.destroy();
});
