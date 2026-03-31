import { BrowserWindow } from 'electron'

let win: BrowserWindow | null = null

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function showDownloadWindow(title: string): void {
  if (win && !win.isDestroyed()) {
    win.focus()
    return
  }

  win = new BrowserWindow({
    width: 360,
    height: 140,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    frame: false,
    transparent: true,
    skipTaskbar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  win.center()

  const safeTitle = escapeHtml(title)

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline';">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    background: rgba(40, 40, 40, 0.92);
    color: white;
    border-radius: 12px;
    overflow: hidden;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    -webkit-app-region: drag;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
  .title { font-size: 14px; font-weight: 600; margin-bottom: 12px; }
  .subtitle { font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 16px; }
  .progress-bar {
    width: 100%;
    height: 6px;
    background: rgba(255,255,255,0.15);
    border-radius: 3px;
    overflow: hidden;
  }
  .progress-fill {
    height: 100%;
    background: #3b82f6;
    border-radius: 3px;
    width: 0%;
    transition: width 0.3s ease;
  }
  .percent { font-size: 12px; color: rgba(255,255,255,0.5); margin-top: 8px; }
</style>
</head>
<body>
  <div class="title">${safeTitle}</div>
  <div class="subtitle">Please wait...</div>
  <div class="progress-bar"><div class="progress-fill" id="fill"></div></div>
  <div class="percent" id="percent">0%</div>
</body>
</html>`

  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  win.on('closed', () => { win = null })
}

export function updateDownloadProgress(downloaded: number, total: number, fileName: string): void {
  if (!win || win.isDestroyed()) return
  const percent = total > 0 ? Math.round((downloaded / total) * 100) : 0
  // Sanitize values — percent is a safe integer, fileName needs escaping
  const safeFileName = escapeHtml(fileName)
  win.webContents.executeJavaScript(
    `document.getElementById('fill').style.width='${percent}%';` +
    `document.getElementById('percent').textContent='${percent}% \\u2014 ${safeFileName.replace(/'/g, "\\'")}';`
  ).catch(() => {})
}

export function closeDownloadWindow(): void {
  if (win && !win.isDestroyed()) {
    win.close()
    win = null
  }
}
