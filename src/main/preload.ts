import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods to renderer process
contextBridge.exposeInMainWorld('visperAPI', {
  // Recording
  recording: {
    sendAudioData: (audioBuffer: ArrayBuffer) =>
      ipcRenderer.invoke('recording:audio-data', audioBuffer),
    onToggle: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on('hotkey:toggle-recording', handler);
      return () => ipcRenderer.removeListener('hotkey:toggle-recording', handler);
    }
  },

  // History
  history: {
    get: (page: number, limit: number) =>
      ipcRenderer.invoke('history:get', page, limit),
    search: (query: string, page: number, limit: number) =>
      ipcRenderer.invoke('history:search', query, page, limit),
    delete: (id: number) =>
      ipcRenderer.invoke('history:delete', id),
    save: (text: string, durationSeconds: number) =>
      ipcRenderer.invoke('history:save', text, durationSeconds)
  },

  // Settings
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
    getApiKey: () => ipcRenderer.invoke('settings:get-api-key'),
    setApiKey: (key: string) => ipcRenderer.invoke('settings:set-api-key', key),
    testApi: (key?: string) => ipcRenderer.invoke('settings:test-api', key)
  },

  // Clipboard
  clipboard: {
    copy: (text: string) => ipcRenderer.invoke('clipboard:copy', text)
  },

  // Window
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    close: () => ipcRenderer.send('window:close')
  },

  // App
  app: {
    isFirstLaunch: () => ipcRenderer.invoke('app:is-first-launch'),
    completeSetup: () => ipcRenderer.invoke('app:complete-setup')
  }
});

// Type definitions for the exposed API
export interface VisperAPI {
  recording: {
    sendAudioData: (audioBuffer: ArrayBuffer) => Promise<{ success: boolean; text?: string; error?: string }>;
    onToggle: (callback: () => void) => () => void;
  };
  history: {
    get: (page: number, limit: number) => Promise<{ items: any[]; total: number }>;
    search: (query: string, page: number, limit: number) => Promise<{ items: any[]; total: number }>;
    delete: (id: number) => Promise<boolean>;
    save: (text: string, durationSeconds: number) => Promise<number>;
  };
  settings: {
    get: () => Promise<Record<string, any>>;
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
