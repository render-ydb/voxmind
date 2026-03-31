import { clipboard } from 'electron'
import { execFile } from 'child_process'
import { loadSettings } from './settings.js'

let injecting = false
let _targetApp = ''

export function getTargetApp(): string {
  return _targetApp
}

/** Sanitize app name to prevent AppleScript/shell injection */
function sanitizeAppName(name: string): string {
  return name.replace(/[\\\"\'&;`|$(){}]/g, '')
}

/** Call this before the user clicks (e.g. on mouseenter) to remember which app should receive the text. */
export function setTargetApp(appName: string): void {
  const sanitized = sanitizeAppName(appName)
  if (sanitized && sanitized !== 'Electron' && sanitized !== 'voxmind') {
    _targetApp = sanitized
    console.log('[injector] Target app saved:', appName)
  }
}

export async function captureTargetApp(): Promise<void> {
  try {
    const name = await runAppleScriptResult(
      'tell application "System Events" to get name of first application process whose frontmost is true'
    )
    setTargetApp(name)
  } catch (err) {
    console.error('[injector] Failed to capture target app:', err)
  }
}

export async function injectText(text: string): Promise<void> {
  if (injecting) {
    console.warn('[injector] Already injecting, skipping')
    return
  }
  injecting = true

  try {
    // Save current clipboard state
    const savedText = clipboard.readText()
    const savedHTML = clipboard.readHTML()
    const savedRTF = clipboard.readRTF()
    const savedImage = clipboard.readImage()
    const hasImage = !savedImage.isEmpty()

    // Write text to clipboard
    clipboard.writeText(text)

    // Activate the target app explicitly so it receives the paste
    if (_targetApp) {
      console.log('[injector] Activating target app:', _targetApp)
      await runAppleScript(
        `tell application "${_targetApp}" to activate`
      )
      await sleep(150)
    }

    // Simulate Cmd+V via AppleScript
    await runAppleScript(
      'tell application "System Events" to keystroke "v" using command down'
    )

    // Wait for paste to complete
    await sleep(200)

    // Auto send: simulate Enter key if enabled
    if (loadSettings().autoSend) {
      await sleep(1000)
      await runAppleScript(
        'tell application "System Events" to key code 36'
      )
    }

    // Restore previous clipboard
    if (hasImage) {
      clipboard.writeImage(savedImage)
    } else if (savedText || savedHTML || savedRTF) {
      clipboard.write({
        text: savedText,
        html: savedHTML,
        rtf: savedRTF
      })
    } else {
      clipboard.writeText('')
    }

    console.log('[injector] Text injected successfully:', text.substring(0, 50))
  } finally {
    injecting = false
  }
}

function runAppleScript(script: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

function runAppleScriptResult(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], (err, stdout) => {
      if (err) reject(err)
      else resolve(stdout.trim())
    })
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
