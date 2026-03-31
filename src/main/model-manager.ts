import { app } from 'electron'
import { existsSync } from 'fs'
import { join } from 'path'

const SENSEVOICE_DIR = 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17'
const SENSEVOICE_MODEL = 'model.int8.onnx'
const SENSEVOICE_TOKENS = 'tokens.txt'
const SILERO_VAD_FILE = 'silero_vad.onnx'
const LLM_MODEL_FILE = 'qwen2.5-1.5b-instruct-q4_k_m.gguf'

export function getDataDir(): string {
  return join(app.getPath('userData'), 'data')
}

export function getModelsDir(): string {
  return join(getDataDir(), 'models')
}

export function getSenseVoiceModelPath(): string {
  return join(getModelsDir(), SENSEVOICE_DIR, SENSEVOICE_MODEL)
}

export function getSenseVoiceTokensPath(): string {
  return join(getModelsDir(), SENSEVOICE_DIR, SENSEVOICE_TOKENS)
}

export function getSileroVadPath(): string {
  return join(getModelsDir(), SILERO_VAD_FILE)
}

export function getLLMModelPath(): string {
  return join(getModelsDir(), 'llm', LLM_MODEL_FILE)
}

export function areModelsReady(): boolean {
  return (
    existsSync(getSenseVoiceModelPath()) &&
    existsSync(getSenseVoiceTokensPath()) &&
    existsSync(getSileroVadPath())
  )
}

export function isLLMModelReady(): boolean {
  return existsSync(getLLMModelPath())
}
