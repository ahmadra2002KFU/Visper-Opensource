import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { WindowService } from './window.service.js';

// Get icon path - works in both dev and production
function getIconPath(): string {
  const isDev = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  if (isDev) {
    return path.join(app.getAppPath(), 'resources', 'icon.png');
  }
  return path.join(process.resourcesPath, 'icon.png');
}

export class TrayService {
  private tray: Tray | null = null;
  private windowService: WindowService;
  private isRecording = false;
  private normalIcon: Electron.NativeImage | null = null;
  private recordingIcon: Electron.NativeImage | null = null;

  constructor(windowService: WindowService) {
    this.windowService = windowService;
    this.loadIcons();
    this.createTray();
  }

  private loadIcons() {
    const iconPath = getIconPath();

    try {
      // Load the logo and resize for tray (16x16)
      const originalIcon = nativeImage.createFromPath(iconPath);
      this.normalIcon = originalIcon.resize({ width: 16, height: 16 });

      // For recording, we'll use a red-tinted version or fallback to SVG indicator
      // Since nativeImage doesn't easily support color modification,
      // we'll create a simple recording indicator
      this.recordingIcon = this.createRecordingIndicator();
    } catch (error) {
      console.error('Failed to load tray icon:', error);
      // Fallback to simple icons
      this.normalIcon = this.createFallbackIcon(false);
      this.recordingIcon = this.createFallbackIcon(true);
    }
  }

  private createRecordingIndicator(): Electron.NativeImage {
    // Create a recording indicator (red dot with white center)
    const size = 16;
    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="#ef4444"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 4}" fill="white"/>
      </svg>
    `;
    return nativeImage.createFromBuffer(Buffer.from(svg), { width: size, height: size });
  }

  private createFallbackIcon(recording: boolean): Electron.NativeImage {
    const size = 16;
    const color = recording ? '#ef4444' : '#f97316'; // Red or Orange (Visper brand)
    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="${color}"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 4}" fill="white"/>
      </svg>
    `;
    return nativeImage.createFromBuffer(Buffer.from(svg), { width: size, height: size });
  }

  private createTray() {
    const icon = this.normalIcon || this.createFallbackIcon(false);
    this.tray = new Tray(icon);

    this.tray.setToolTip('Visper - Press Win+J to dictate');
    this.updateContextMenu();

    // Double-click to show window
    this.tray.on('double-click', () => {
      this.windowService.show();
    });

    // Single click on Windows shows window
    this.tray.on('click', () => {
      this.windowService.toggleVisibility();
    });
  }

  private updateContextMenu() {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: this.isRecording ? 'Stop Recording' : 'Start Recording',
        click: () => {
          this.windowService.show();
          this.windowService.sendToRenderer('hotkey:toggle-recording');
        }
      },
      { type: 'separator' },
      {
        label: 'Show Window',
        click: () => this.windowService.show()
      },
      {
        label: 'History',
        click: () => {
          this.windowService.show();
          this.windowService.sendToRenderer('navigate', 'history');
        }
      },
      {
        label: 'Settings',
        click: () => {
          this.windowService.show();
          this.windowService.sendToRenderer('navigate', 'settings');
        }
      },
      { type: 'separator' },
      {
        label: 'Quit Visper',
        click: () => {
          app.exit(0);
        }
      }
    ]);

    this.tray?.setContextMenu(contextMenu);
  }

  setRecording(isRecording: boolean) {
    this.isRecording = isRecording;
    const icon = isRecording
      ? (this.recordingIcon || this.createFallbackIcon(true))
      : (this.normalIcon || this.createFallbackIcon(false));
    this.tray?.setImage(icon);
    this.tray?.setToolTip(
      isRecording ? 'Visper - Recording...' : 'Visper - Press Win+J to dictate'
    );
    this.updateContextMenu();
  }

  showNotification(title: string, body: string) {
    this.tray?.displayBalloon({
      title,
      content: body,
      iconType: 'info'
    });
  }

  destroy() {
    this.tray?.destroy();
    this.tray = null;
  }
}
