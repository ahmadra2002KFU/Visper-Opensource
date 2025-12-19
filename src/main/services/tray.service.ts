import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'path';
import { WindowService } from './window.service.js';

export class TrayService {
  private tray: Tray | null = null;
  private windowService: WindowService;
  private isRecording = false;

  constructor(windowService: WindowService) {
    this.windowService = windowService;
    this.createTray();
  }

  private createTray() {
    // Create a simple tray icon (16x16 blue circle)
    const icon = this.createIcon(false);
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

  private createIcon(recording: boolean): Electron.NativeImage {
    // Create a simple icon programmatically
    // 16x16 icon - blue for idle, red for recording
    const size = 16;
    const color = recording ? '#ef4444' : '#6366f1'; // Red or Indigo

    // Create SVG string
    const svg = `
      <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 1}" fill="${color}"/>
        <circle cx="${size / 2}" cy="${size / 2}" r="${size / 4}" fill="white"/>
      </svg>
    `;

    return nativeImage.createFromBuffer(
      Buffer.from(svg),
      { width: size, height: size }
    );
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
    const icon = this.createIcon(isRecording);
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
