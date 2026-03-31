// Suppress EPIPE errors on stdout/stderr when running as a packaged .app (no tty)
process.stdout?.on?.('error', () => {})
process.stderr?.on?.('error', () => {})

import { app, BrowserWindow, globalShortcut, dialog } from 'electron'
import { createFloatingBall } from './window.js'
import { registerIpcHandlers, initASREngine } from './ipc-handlers.js'
import { checkPermissions } from './permissions.js'
import { createTray } from './tray.js'
import { areModelsReady } from './model-manager.js'
import { ASREngine } from './asr/engine.js'
import { initLLM } from './llm/engine.js'
import { loadSettings } from './settings.js'
import { captureTargetApp } from './injector.js'
import { downloadASRModels } from './downloader.js'
import { showDownloadWindow, updateDownloadProgress, closeDownloadWindow } from './download-window.js'

let mainWindow: BrowserWindow | null = null

app.whenReady().then(async () => {
  // Hide dock icon in production
  if (app.isPackaged) {
    app.dock?.hide()
  }

  // Check permissions
  await checkPermissions()

  // Register IPC handlers (before window creation so they're ready)
  registerIpcHandlers()

  // Create floating ball window
  mainWindow = createFloatingBall()

  // Create system tray
  createTray(mainWindow)

  // Download ASR models if missing, then initialize
  if (!areModelsReady()) {
    // Wait for renderer to be ready before sending state
    await new Promise<void>((resolve) => {
      if (mainWindow!.webContents.isLoading()) {
        mainWindow!.webContents.once('did-finish-load', () => resolve())
      } else {
        resolve()
      }
    })
    mainWindow.webContents.send('app:state', 'downloading')
    showDownloadWindow('Downloading speech recognition models...')
    try {
      await downloadASRModels((downloaded, total, fileName) => {
        updateDownloadProgress(downloaded, total, fileName)
      })
      closeDownloadWindow()
    } catch (err) {
      closeDownloadWindow()
      mainWindow.webContents.send('app:state', 'idle')
      console.error('[main] ASR model download failed:', err)
      dialog.showErrorBox('Download Failed', `Failed to download ASR models: ${err}. Please check your network and restart.`)
      return
    }
  }

  // Initialize ASR engine
  try {
    console.log('[main] Initializing ASR engine...')
    const engine = new ASREngine()
    initASREngine(engine)
    console.log('[main] ASR engine ready!')
    mainWindow.webContents.send('app:state', 'idle')
  } catch (err) {
    console.error('[main] ASR initialization failed:', err)
  }

  // Initialize LLM if enabled (async, non-blocking)
  const settings = loadSettings()
  if (settings.llmEnabled) {
    initLLM().catch((err) => {
      console.error('[main] LLM init failed (non-fatal):', err)
    })
  }

  // Register global shortcut (Cmd+Shift+Space)
  let isRecording = false
  globalShortcut.register('CommandOrControl+Shift+Space', () => {
    if (!mainWindow) return
    // Shortcut doesn't change focus — capture target app now
    captureTargetApp()
    if (!isRecording) {
      mainWindow.webContents.send('shortcut:toggle', 'start')
      isRecording = true
    } else {
      mainWindow.webContents.send('shortcut:toggle', 'stop')
      isRecording = false
    }
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  app.quit()
})
