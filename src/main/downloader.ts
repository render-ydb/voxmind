import { createWriteStream, mkdirSync, existsSync, renameSync, unlinkSync, readFileSync, readdirSync } from 'fs'
import { createHash } from 'crypto'
import { join, dirname, resolve as pathResolve, normalize } from 'path'
import { execFile } from 'child_process'
import { net } from 'electron'
import {
  getModelsDir,
  getSenseVoiceModelPath,
  getSenseVoiceTokensPath,
  getSileroVadPath,
  getLLMModelPath
} from './model-manager.js'

export type ProgressCallback = (downloaded: number, total: number, fileName: string) => void

const SILERO_VAD_URL =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx'
const SENSEVOICE_URL =
  'https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17.tar.bz2'
const LLM_URL =
  'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf'

// SHA-256 hashes for integrity verification
// To populate: download each file manually and run `shasum -a 256 <file>`
// When a hash is empty, the download proceeds with a warning (no verification)
const EXPECTED_HASHES: Record<string, string> = {
  // Populate after first verified download with: shasum -a 256 <file>
  // 'silero_vad.onnx': '<sha256>',
  // 'sensevoice.tar.bz2': '<sha256>',
  // 'qwen2.5-1.5b-instruct-q4_k_m.gguf': '<sha256>',
}

const ALLOWED_REDIRECT_DOMAINS = [
  'github.com',
  'objects.githubusercontent.com',
  'github-releases.githubusercontent.com',
  'huggingface.co',
  'cdn-lfs.huggingface.co',
  'cdn-lfs-us-1.huggingface.co',
  'cdn-lfs-eu-1.huggingface.co',
]

function isAllowedRedirectDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname
    return ALLOWED_REDIRECT_DOMAINS.some(
      (domain) => hostname === domain || hostname.endsWith('.' + domain)
    )
  } catch {
    return false
  }
}

function verifyFileHash(filePath: string, expectedHash: string): boolean {
  const fileBuffer = readFileSync(filePath)
  const hash = createHash('sha256').update(fileBuffer).digest('hex')
  return hash === expectedHash
}

function downloadFile(url: string, destPath: string, onProgress?: ProgressCallback): Promise<void> {
  return new Promise((resolve, reject) => {
    const tmpPath = destPath + '.tmp'
    mkdirSync(dirname(destPath), { recursive: true })

    // Clean up previous incomplete download
    if (existsSync(tmpPath)) {
      unlinkSync(tmpPath)
    }

    const fileName = destPath.split('/').pop() || ''
    const request = net.request(url)

    request.on('response', (response) => {
      // Handle redirects with domain validation
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const redirectUrl = Array.isArray(response.headers.location)
          ? response.headers.location[0]
          : response.headers.location
        if (!isAllowedRedirectDomain(redirectUrl)) {
          reject(new Error(`Redirect to untrusted domain: ${redirectUrl}`))
          return
        }
        downloadFile(redirectUrl, destPath, onProgress).then(resolve).catch(reject)
        return
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${response.statusCode} for ${url}`))
        return
      }

      const contentLength = response.headers['content-length']
      const total = contentLength
        ? parseInt(Array.isArray(contentLength) ? contentLength[0] : contentLength, 10)
        : 0
      let downloaded = 0

      const fileStream = createWriteStream(tmpPath)

      response.on('data', (chunk: Buffer) => {
        fileStream.write(chunk)
        downloaded += chunk.length
        onProgress?.(downloaded, total, fileName)
      })

      response.on('end', () => {
        fileStream.end(() => {
          // Verify hash if available
          const expectedHash = EXPECTED_HASHES[fileName]
          if (expectedHash) {
            if (!verifyFileHash(tmpPath, expectedHash)) {
              unlinkSync(tmpPath)
              reject(new Error(`Integrity check failed for ${fileName}: SHA-256 mismatch`))
              return
            }
            console.log(`[downloader] Integrity verified: ${fileName}`)
          } else {
            console.warn(`[downloader] No hash available for ${fileName}, skipping integrity check`)
          }
          renameSync(tmpPath, destPath)
          resolve()
        })
      })

      response.on('error', (err) => {
        fileStream.close()
        if (existsSync(tmpPath)) unlinkSync(tmpPath)
        reject(err)
      })
    })

    request.on('error', (err) => {
      if (existsSync(tmpPath)) unlinkSync(tmpPath)
      reject(err)
    })

    request.end()
  })
}

function extractTarBz2(archivePath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    mkdirSync(destDir, { recursive: true })
    execFile('tar', ['xjf', archivePath, '-C', destDir], (err) => {
      if (err) {
        reject(new Error(`tar extraction failed: ${err.message}`))
        return
      }
      // Verify no path traversal: all extracted files must be within destDir
      const resolvedDest = pathResolve(destDir)
      const entries = readdirSync(destDir, { recursive: true }) as string[]
      for (const entry of entries) {
        const fullPath = pathResolve(destDir, entry)
        if (!normalize(fullPath).startsWith(resolvedDest)) {
          reject(new Error(`Path traversal detected in archive: ${entry}`))
          return
        }
      }
      resolve()
    })
  })
}

export async function downloadASRModels(onProgress?: ProgressCallback): Promise<void> {
  const modelsDir = getModelsDir()
  mkdirSync(modelsDir, { recursive: true })

  // 1. Download Silero VAD (small, ~632KB)
  const vadPath = getSileroVadPath()
  if (!existsSync(vadPath)) {
    console.log('[downloader] Downloading Silero VAD...')
    await downloadFile(SILERO_VAD_URL, vadPath, onProgress)
    console.log('[downloader] Silero VAD downloaded')
  }

  // 2. Download SenseVoice (tar.bz2 archive, ~228MB)
  const modelPath = getSenseVoiceModelPath()
  const tokensPath = getSenseVoiceTokensPath()
  if (!existsSync(modelPath) || !existsSync(tokensPath)) {
    const archivePath = join(modelsDir, 'sensevoice.tar.bz2')
    console.log('[downloader] Downloading SenseVoice...')
    await downloadFile(SENSEVOICE_URL, archivePath, onProgress)
    console.log('[downloader] Extracting SenseVoice...')
    onProgress?.(0, 0, 'Extracting SenseVoice...')
    await extractTarBz2(archivePath, modelsDir)
    // Remove archive after extraction
    if (existsSync(archivePath)) unlinkSync(archivePath)
    console.log('[downloader] SenseVoice ready')
  }
}

export async function downloadLLMModel(onProgress?: ProgressCallback): Promise<void> {
  const llmPath = getLLMModelPath()
  if (!existsSync(llmPath)) {
    mkdirSync(dirname(llmPath), { recursive: true })
    console.log('[downloader] Downloading Qwen LLM...')
    await downloadFile(LLM_URL, llmPath, onProgress)
    console.log('[downloader] Qwen LLM downloaded')
  }
}
