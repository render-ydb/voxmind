import { ipcMain, BrowserWindow } from 'electron'
import { ASREngine } from './asr/engine.js'
import { injectText, captureTargetApp, getTargetApp } from './injector.js'
import { correctText, isLLMReady } from './llm/engine.js'
import { loadSettings } from './settings.js'
import { saveTranscript } from './history.js'

let asrEngine: ASREngine | null = null

export function initASREngine(engine: ASREngine): void {
  asrEngine = engine
}

let dragStartPos = { x: 0, y: 0 }

export function registerIpcHandlers(): void {
  ipcMain.on('window:start-drag', (event, screenX: number, screenY: number) => {
    if (typeof screenX !== 'number' || typeof screenY !== 'number') return
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    const [winX, winY] = win.getPosition()
    dragStartPos = { x: screenX - winX, y: screenY - winY }
  })

  ipcMain.on('window:dragging', (event, screenX: number, screenY: number) => {
    if (typeof screenX !== 'number' || typeof screenY !== 'number') return
    if (!Number.isFinite(screenX) || !Number.isFinite(screenY)) return
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    win.setPosition(screenX - dragStartPos.x, screenY - dragStartPos.y)
  })

  ipcMain.on('target-app:save', () => {
    captureTargetApp()
  })

  ipcMain.on('asr:start', (event) => {
    console.log('[ipc] ASR start')
    const win = BrowserWindow.fromWebContents(event.sender)

    if (!asrEngine) {
      console.error('[ipc] ASR engine not ready')
      win?.webContents.send('app:state', 'idle')
      return
    }

    asrEngine.setPartialCallback((text) => {
      win?.webContents.send('asr:partial', text)
    })
    asrEngine.start()
    win?.webContents.send('app:state', 'recording')
  })

  ipcMain.on('asr:stop', async (event) => {
    console.log('[ipc] ASR stop')
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.webContents.send('app:state', 'processing')

    if (!asrEngine) {
      win?.webContents.send('app:state', 'idle')
      return
    }

    try {
      const text = asrEngine.stop()

      if (text) {
        // LLM correction if enabled
        const settings = loadSettings()
        let finalText = text
        if (settings.llmEnabled && isLLMReady()) {
          finalText = await correctText(text)
        }
        await injectText(finalText)
        win?.webContents.send('asr:result', text)
        saveTranscript(text, finalText !== text ? finalText : null, getTargetApp())
      }
    } catch (err) {
      console.error('[ipc] ASR/inject error:', err)
    } finally {
      win?.webContents.send('app:state', 'idle')
    }
  })

  ipcMain.on('audio:chunk', (_event, chunk: unknown) => {
    if (!asrEngine) return
    // Validate and coerce to Float32Array
    if (!chunk || (!(chunk instanceof Float32Array) && !Array.isArray(chunk))) return
    const samples = chunk instanceof Float32Array ? chunk : new Float32Array(chunk as number[])
    if (samples.length === 0 || samples.length > 16000 * 10) return // max 10s per chunk
    asrEngine.feedAudio(samples)
  })
}
