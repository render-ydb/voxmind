import { app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

export interface Settings {
  ballPosition: { x: number; y: number } | null
  llmEnabled: boolean
  openAtLogin: boolean
  autoSend: boolean
}

const defaultSettings: Settings = {
  ballPosition: null,
  llmEnabled: false,
  openAtLogin: false,
  autoSend: false
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function loadSettings(): Settings {
  const p = getSettingsPath()
  if (!existsSync(p)) return { ...defaultSettings }
  try {
    return { ...defaultSettings, ...JSON.parse(readFileSync(p, 'utf-8')) }
  } catch {
    return { ...defaultSettings }
  }
}

export function saveSettings(settings: Settings): void {
  writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2))
}
