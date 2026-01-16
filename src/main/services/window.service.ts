import { BrowserWindow, screen, app, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get icon path - works in both dev and production
function getIconPath(): string {
  // Use ICO for Windows, PNG for other platforms
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  if (app.isPackaged) {
    return path.join(process.resourcesPath, iconFile);
  }
  return path.join(app.getAppPath(), 'resources', iconFile);
}

export class WindowService {
  mainWindow: BrowserWindow | null = null;

  async createMainWindow(): Promise<BrowserWindow> {
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;

    // Load icon for taskbar
    const iconPath = getIconPath();

    this.mainWindow = new BrowserWindow({
      width: 280,
      height: 420,
      x: screenWidth - 300,
      y: screenHeight - 440,
      minWidth: 260,
      minHeight: 380,
      maxWidth: 360,
      maxHeight: 550,
      frame: false,
      transparent: true,
      resizable: true,
      skipTaskbar: false,
      show: false,
      icon: iconPath,
      webPreferences: {
        preload: path.join(__dirname, '..', 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });

    // Load the app
    if (app.isPackaged) {
      // Production: load from asar
      // __dirname is dist/main/services/, so we need ../../renderer/
      await this.mainWindow.loadFile(path.join(__dirname, '../../renderer/index.html'));
    } else {
      // Development: load from Vite dev server
      await this.mainWindow.loadURL('http://localhost:5173');
      this.mainWindow.webContents.openDevTools({ mode: 'detach' });
    }

    // Show window when ready
    this.mainWindow.once('ready-to-show', () => {
      this.mainWindow?.show();
    });

    // Handle close event - minimize to tray instead
    this.mainWindow.on('close', (event) => {
      event.preventDefault();
      this.minimizeToTray();
    });

    // Background throttling when hidden
    this.mainWindow.on('hide', () => {
      this.mainWindow?.webContents.setBackgroundThrottling(true);
    });

    this.mainWindow.on('show', () => {
      this.mainWindow?.webContents.setBackgroundThrottling(false);
    });

    return this.mainWindow;
  }

  show() {
    if (this.mainWindow) {
      if (this.mainWindow.isMinimized()) {
        this.mainWindow.restore();
      }
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  hide() {
    this.mainWindow?.hide();
  }

  minimizeToTray() {
    this.mainWindow?.hide();
  }

  toggleVisibility() {
    if (this.mainWindow?.isVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  sendToRenderer(channel: string, ...args: any[]) {
    this.mainWindow?.webContents.send(channel, ...args);
  }
}
