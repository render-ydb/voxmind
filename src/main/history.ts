import { join } from 'path'
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync } from 'fs'

const MAX_TOTAL_SIZE = 500 * 1024 * 1024 // 500MB

function getHistoryDir(): string {
  return join(app.getPath('userData'), 'data', 'history')
}

export function getHistoryPath(): string {
  const dir = getHistoryDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

export function saveTranscript(rawText: string, correctedText: string | null, targetApp: string): void {
  try {
    const now = new Date()
    const dateDir = now.toISOString().split('T')[0] // YYYY-MM-DD
    const timeKey =
      now.getHours().toString().padStart(2, '0') +
      ':' +
      now.getMinutes().toString().padStart(2, '0') +
      ':' +
      now.getSeconds().toString().padStart(2, '0')

    const dir = join(getHistoryDir(), dateDir)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    const filePath = join(dir, 'transcripts.json')
    let data: Record<string, { raw: string; corrected: string | null; targetApp: string }> = {}

    if (existsSync(filePath)) {
      try {
        data = JSON.parse(readFileSync(filePath, 'utf-8'))
      } catch {
        data = {}
      }
    }

    data[timeKey] = { raw: rawText, corrected: correctedText, targetApp }
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8')

    cleanupIfNeeded()
  } catch (err) {
    console.error('[history] Failed to save transcript:', err)
  }
}

function cleanupIfNeeded(): void {
  const historyDir = getHistoryDir()
  if (!existsSync(historyDir)) return

  const dateDirs = readdirSync(historyDir)
    .filter((name) => /^\d{4}-\d{2}-\d{2}$/.test(name))
    .sort()

  let totalSize = 0
  const dirSizes: { name: string; size: number }[] = []

  for (const name of dateDirs) {
    const dirPath = join(historyDir, name)
    const size = getDirSize(dirPath)
    dirSizes.push({ name, size })
    totalSize += size
  }

  while (totalSize > MAX_TOTAL_SIZE && dirSizes.length > 1) {
    const oldest = dirSizes.shift()!
    rmSync(join(historyDir, oldest.name), { recursive: true, force: true })
    totalSize -= oldest.size
    console.log(`[history] Removed old history: ${oldest.name} (${(oldest.size / 1024).toFixed(1)}KB)`)
  }
}

function getDirSize(dirPath: string): number {
  let size = 0
  try {
    const entries = readdirSync(dirPath)
    for (const entry of entries) {
      const entryPath = join(dirPath, entry)
      const stat = statSync(entryPath)
      if (stat.isFile()) {
        size += stat.size
      }
    }
  } catch {
    // ignore
  }
  return size
}
