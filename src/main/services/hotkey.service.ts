import { globalShortcut } from 'electron';
import { WindowService } from './window.service.js';

export class HotkeyService {
  private windowService: WindowService;
  private isRegistered = false;
  private winKeyPressed = false;

  constructor(windowService: WindowService) {
    this.windowService = windowService;
  }

  register(): boolean {
    // Try to register Win+J using Super modifier
    // In Electron, 'Super' refers to the Windows key on Windows
    try {
      // Primary hotkey: Win+J
      const primaryRegistered = globalShortcut.register('Super+J', () => {
        this.handleHotkey();
      });

      if (primaryRegistered) {
        this.isRegistered = true;
        console.log('Hotkey Win+J registered successfully');
        return true;
      }

      // Fallback: Ctrl+Alt+J
      console.log('Win+J failed, trying Ctrl+Alt+J fallback');
      const fallbackRegistered = globalShortcut.register('Ctrl+Alt+J', () => {
        this.handleHotkey();
      });

      if (fallbackRegistered) {
        this.isRegistered = true;
        console.log('Fallback hotkey Ctrl+Alt+J registered successfully');
        return true;
      }

      console.error('Failed to register any hotkey');
      return false;
    } catch (error) {
      console.error('Error registering hotkey:', error);
      return false;
    }
  }

  private handleHotkey() {
    // Show window if hidden
    if (!this.windowService.mainWindow?.isVisible()) {
      this.windowService.show();
    }

    // Send toggle event to renderer
    this.windowService.sendToRenderer('hotkey:toggle-recording');
  }

  unregister() {
    if (this.isRegistered) {
      globalShortcut.unregisterAll();
      this.isRegistered = false;
      console.log('Hotkeys unregistered');
    }
  }

  isHotkeyRegistered(): boolean {
    return this.isRegistered;
  }
}
