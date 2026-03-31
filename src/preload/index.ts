import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  startRecording: () => void
  stopRecording: () => void
  sendAudioChunk: (chunk: Float32Array) => void
  onStateChange: (callback: (state: string) => void) => () => void
  onTranscription: (callback: (text: string) => void) => () => void
  onPartialResult: (callback: (text: string) => void) => () => void
  onShortcutToggle: (callback: (action: string) => void) => () => void
  startDrag: (x: number, y: number) => void
  dragging: (dx: number, dy: number) => void
  saveTargetApp: () => void
}

const api: ElectronAPI = {
  startRecording: () => ipcRenderer.send('asr:start'),
  stopRecording: () => ipcRenderer.send('asr:stop'),
  sendAudioChunk: (chunk: Float32Array) => ipcRenderer.send('audio:chunk', chunk),

  onStateChange: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, state: string) => callback(state)
    ipcRenderer.on('app:state', handler)
    return () => ipcRenderer.removeListener('app:state', handler)
  },

  onTranscription: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, text: string) => callback(text)
    ipcRenderer.on('asr:result', handler)
    return () => ipcRenderer.removeListener('asr:result', handler)
  },

  onPartialResult: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, text: string) => callback(text)
    ipcRenderer.on('asr:partial', handler)
    return () => ipcRenderer.removeListener('asr:partial', handler)
  },

  onShortcutToggle: (callback) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string) => callback(action)
    ipcRenderer.on('shortcut:toggle', handler)
    return () => ipcRenderer.removeListener('shortcut:toggle', handler)
  },

  startDrag: (x: number, y: number) => ipcRenderer.send('window:start-drag', x, y),
  dragging: (dx: number, dy: number) => ipcRenderer.send('window:dragging', dx, dy),
  saveTargetApp: () => ipcRenderer.send('target-app:save')
}

contextBridge.exposeInMainWorld('electronAPI', api)
