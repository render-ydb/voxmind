import { BrowserWindow, screen, app } from 'electron'
import { join } from 'path'
import { loadSettings, saveSettings } from './settings.js'

export function createFloatingBall(): BrowserWindow {
  const settings = loadSettings()
  const display = screen.getPrimaryDisplay()
  const { width: screenW, height: screenH } = display.workAreaSize

  // Default position: bottom-right
  const defaultX = screenW - 100
  const defaultY = screenH - 120
  const x = settings.ballPosition?.x ?? defaultX
  const y = settings.ballPosition?.y ?? defaultY

  const win = new BrowserWindow({
    width: 80,
    height: 80,
    x,
    y,
    transparent: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    roundedCorners: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.setAlwaysOnTop(true, 'screen-saver')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  // Save position on move
  win.on('moved', () => {
    const [newX, newY] = win.getPosition()
    const s = loadSettings()
    s.ballPosition = { x: newX, y: newY }
    saveSettings(s)
  })

  // Load renderer
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // // Open DevTools in dev mode for debugging
  // if (!app.isPackaged) {
  //   win.webContents.openDevTools({ mode: 'detach' })
  // }

  win.showInactive()

  return win
}
