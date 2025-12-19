import Store from 'electron-store';
import { safeStorage, app } from 'electron';
import fs from 'fs';
import path from 'path';

interface Settings {
  theme: 'light' | 'dark' | 'system';
  soundEnabled: boolean;
  firstLaunchComplete: boolean;
  hotkey: string;
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'light',
  soundEnabled: true,
  firstLaunchComplete: false,
  hotkey: 'Super+J'
};

export class SettingsService {
  private store: Store<Settings>;
  private secureKeyPath: string;

  constructor() {
    this.store = new Store<Settings>({
      defaults: DEFAULT_SETTINGS
    }) as Store<Settings>;

    this.secureKeyPath = path.join(app.getPath('userData'), 'secure-key.enc');
  }

  getAll(): Settings {
    return {
      theme: (this.store as any).get('theme'),
      soundEnabled: (this.store as any).get('soundEnabled'),
      firstLaunchComplete: (this.store as any).get('firstLaunchComplete'),
      hotkey: (this.store as any).get('hotkey')
    };
  }

  get<K extends keyof Settings>(key: K): Settings[K] {
    return (this.store as any).get(key);
  }

  set<K extends keyof Settings>(key: K, value: Settings[K]): void {
    (this.store as any).set(key, value);
  }

  // Secure API key storage using Windows DPAPI
  async getApiKey(): Promise<string | null> {
    try {
      if (!fs.existsSync(this.secureKeyPath)) {
        return null;
      }

      if (!safeStorage.isEncryptionAvailable()) {
        // Fallback: read as plain text (not recommended, but works)
        return fs.readFileSync(this.secureKeyPath, 'utf-8');
      }

      const encryptedKey = fs.readFileSync(this.secureKeyPath);
      const decryptedKey = safeStorage.decryptString(encryptedKey);
      return decryptedKey || null;
    } catch (error) {
      console.error('Error reading API key:', error);
      return null;
    }
  }

  async setApiKey(apiKey: string): Promise<void> {
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encryptedKey = safeStorage.encryptString(apiKey);
        fs.writeFileSync(this.secureKeyPath, encryptedKey);
      } else {
        // Fallback: store as plain text (not recommended)
        fs.writeFileSync(this.secureKeyPath, apiKey);
      }
    } catch (error) {
      console.error('Error saving API key:', error);
      throw error;
    }
  }

  async clearApiKey(): Promise<void> {
    try {
      if (fs.existsSync(this.secureKeyPath)) {
        fs.unlinkSync(this.secureKeyPath);
      }
    } catch (error) {
      console.error('Error clearing API key:', error);
    }
  }

  isFirstLaunch(): boolean {
    return !(this.store as any).get('firstLaunchComplete');
  }

  completeSetup(): void {
    (this.store as any).set('firstLaunchComplete', true);
  }

  reset(): void {
    (this.store as any).clear();
    this.clearApiKey();
  }
}
