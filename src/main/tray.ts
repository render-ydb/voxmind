import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { Tray, Menu, app, shell, BrowserWindow, nativeImage } from 'electron'
import { loadSettings, saveSettings } from './settings.js'
import { initLLM } from './llm/engine.js'
import { isLLMModelReady, getDataDir } from './model-manager.js'
import { downloadLLMModel } from './downloader.js'
import { showDownloadWindow, updateDownloadProgress, closeDownloadWindow } from './download-window.js'

let tray: Tray | null = null
let mainWindow: BrowserWindow | null = null

export function createTray(_mainWindow: BrowserWindow): void {
  mainWindow = _mainWindow
  // Load colored tray icon from resources (tray.png + tray@2x.png)
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'tray.png')
    : join(app.getAppPath(), 'resources', 'tray.png')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.resize({ width: 18, height: 18 }))

  updateMenu()
  tray.setToolTip('VoxMind')
}

function updateMenu(): void {
  if (!tray) return
  const settings = loadSettings()

  const contextMenu = Menu.buildFromTemplate([
    { label: 'VoxMind', enabled: false },
    { type: 'separator' },
    {
      label: 'LLM Correction',
      type: 'checkbox',
      checked: settings.llmEnabled,
      click: async (item) => {
        const s = loadSettings()
        s.llmEnabled = item.checked
        saveSettings(s)
        if (item.checked) {
          if (!isLLMModelReady()) {
            mainWindow?.webContents.send('app:state', 'downloading')
            showDownloadWindow('Downloading LLM model...')
            try {
              await downloadLLMModel((downloaded, total, fileName) => {
                updateDownloadProgress(downloaded, total, fileName)
              })
              closeDownloadWindow()
            } catch (err) {
              closeDownloadWindow()
              console.error('[tray] LLM model download failed:', err)
              s.llmEnabled = false
              saveSettings(s)
              updateMenu()
              mainWindow?.webContents.send('app:state', 'idle')
              return
            }
            mainWindow?.webContents.send('app:state', 'idle')
          }
          initLLM().catch((err) => console.error('[tray] LLM init failed:', err))
        }
      }
    },
    {
      label: 'Open at Login',
      type: 'checkbox',
      checked: settings.openAtLogin,
      click: (item) => {
        const s = loadSettings()
        s.openAtLogin = item.checked
        saveSettings(s)
        app.setLoginItemSettings({ openAtLogin: item.checked })
      }
    },
    {
      label: 'Auto Send',
      type: 'checkbox',
      checked: settings.autoSend,
      click: (item) => {
        const s = loadSettings()
        s.autoSend = item.checked
        saveSettings(s)
      }
    },
    {
      label: 'Open Data Folder',
      click: () => {
        const dir = getDataDir()
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true })
        }
        shell.openPath(dir)
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => app.quit()
    }
  ])

  tray.setContextMenu(contextMenu)
}
