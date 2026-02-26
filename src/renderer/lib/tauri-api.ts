import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { getCurrentWindow } from '@tauri-apps/api/window';

// Types matching the Rust backend
interface TranscriptionResult {
  success: boolean;
  text?: string;
  error?: string;
}

interface Transcription {
  id: number;
  text: string;
  durationSeconds: number | null;
  tokensUsed: number | null;
  createdAt: string;
  isFavorite: number;
}

interface HistoryResult {
  items: Transcription[];
  total: number;
}

interface Settings {
  theme: 'light' | 'dark' | 'system';
  soundEnabled: boolean;
  firstLaunchComplete: boolean;
  hotkey: string;
}

interface SetApiKeyResult {
  success: boolean;
  error?: string;
}

interface TestApiResult {
  success: boolean;
  error?: string;
}

// Create the same API interface as Electron's preload
export const visperAPI = {
  recording: {
    sendAudioData: async (audioBuffer: ArrayBuffer): Promise<TranscriptionResult> => {
      // Convert ArrayBuffer to number array for Tauri serialization
      const uint8Array = new Uint8Array(audioBuffer);
      return invoke<TranscriptionResult>('send_audio_data', {
        audioBuffer: Array.from(uint8Array),
        mimeType: "audio/wav"
      });
    },

    onToggle: (callback: () => void): (() => void) => {
      let unlisten: (() => void) | null = null;

      listen<void>('hotkey:toggle-recording', () => {
        callback();
      }).then(fn => {
        unlisten = fn;
      });

      // Return unsubscribe function
      return () => {
        if (unlisten) unlisten();
      };
    }
  },

  history: {
    get: async (page: number, limit: number): Promise<HistoryResult> => {
      return invoke<HistoryResult>('history_get', { page, limit });
    },

    search: async (query: string, page: number, limit: number): Promise<HistoryResult> => {
      return invoke<HistoryResult>('history_search', { query, page, limit });
    },

    save: async (text: string, durationSeconds: number): Promise<number> => {
      return invoke<number>('history_save', { text, durationSeconds });
    },

    delete: async (id: number): Promise<boolean> => {
      return invoke<boolean>('history_delete', { id });
    },

    clear: async (): Promise<void> => {
      return invoke<void>('history_clear');
    },

    toggleFavorite: async (id: number): Promise<boolean> => {
      return invoke<boolean>('toggle_favorite', { id });
    }
  },

  settings: {
    get: async (): Promise<Settings> => {
      return invoke<Settings>('settings_get');
    },

    set: async (key: string, value: unknown): Promise<void> => {
      return invoke<void>('settings_set', { key, value });
    },

    getApiKey: async (): Promise<string | null> => {
      return invoke<string | null>('get_api_key');
    },

    setApiKey: async (key: string): Promise<SetApiKeyResult> => {
      return invoke<SetApiKeyResult>('set_api_key', { key });
    },

    deleteApiKey: async (): Promise<void> => {
      return invoke<void>('delete_api_key');
    },

    testApi: async (key?: string): Promise<TestApiResult> => {
      return invoke<TestApiResult>('test_api', { key: key || null });
    }
  },

  clipboard: {
    copy: async (text: string): Promise<boolean> => {
      try {
        await writeText(text);
        return true;
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        return false;
      }
    }
  },

  window: {
    minimize: async (): Promise<void> => {
      const window = getCurrentWindow();
      await window.hide();
    },

    close: async (): Promise<void> => {
      const window = getCurrentWindow();
      await window.hide();
    }
  },

  app: {
    isFirstLaunch: async (): Promise<boolean> => {
      return invoke<boolean>('is_first_launch');
    },

    completeSetup: async (): Promise<void> => {
      return invoke<void>('complete_setup');
    }
  }
};

// Expose to window for compatibility with existing code
if (typeof window !== 'undefined') {
  (window as Window & { visperAPI: typeof visperAPI }).visperAPI = visperAPI;

  // Also expose navigation and toast functions that App.svelte sets up
  (window as Window & { visperNavigate?: (view: string) => void }).visperNavigate =
    (window as Window & { visperNavigate?: (view: string) => void }).visperNavigate || (() => {});
  (window as Window & { visperToast?: (msg: string, type: string) => void }).visperToast =
    (window as Window & { visperToast?: (msg: string, type: string) => void }).visperToast || (() => {});
}

// Type declaration for TypeScript
declare global {
  interface Window {
    visperAPI: typeof visperAPI;
    visperNavigate: (view: string) => void;
    visperToast: (message: string, type: 'success' | 'error' | 'info') => void;
  }
}

export type { TranscriptionResult, HistoryResult, Settings, SetApiKeyResult, TestApiResult, Transcription };
