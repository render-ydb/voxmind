import { getLLMModelPath } from '../model-manager.js';

let llama: any = null;
let model: any = null;
let context: any = null;
let session: any = null;
let initialized = false;
let initializing = false;

const SYSTEM_PROMPT = `You are a speech recognition post-processor. Your ONLY job is to fix obvious ASR (automatic speech recognition) errors in the input text.

HARD CONSTRAINTS (HIGHEST PRIORITY):
- ZERO TRANSLATION POLICY: You are STRICTLY FORBIDDEN from translating any word or phrase between languages.
- NEVER convert English to Chinese or Chinese to English under ANY circumstance.
- NEVER replace English words with Chinese equivalents (e.g., "API" MUST NOT become "接口").
- NEVER replace Chinese words with English equivalents.

LANGUAGE PRESERVATION (MANDATORY):
- Preserve the exact language of each word/segment as in the input.
- Mixed-language input MUST remain mixed-language in the output.
- If a word is in English → it MUST stay in English.
- If a word is in Chinese → it MUST stay in Chinese.
- If unsure, KEEP THE ORIGINAL TEXT unchanged.

ALLOWED OPERATIONS (LIMITED):
1. Fix obvious ASR homophone errors (e.g., "派森" -> "Python", "杰森" -> "JSON")
2. Fix minor word boundary issues (split/merge errors)
3. Fix punctuation
4. Fix clear speech-to-text typos

TECHNICAL TERMS:
- Only correct to the original intended term (Python, JSON, API, Redis, TypeScript, etc.)
- Normalize casing ONLY (json -> JSON), DO NOT translate

STRICT PROHIBITIONS:
- NO rewriting
- NO paraphrasing
- NO summarization
- NO adding or removing content
- NO explanation in output

OUTPUT RULES:
- Output ONLY the corrected text
- If no obvious ASR error → return input EXACTLY as-is
`;

export async function initLLM(): Promise<void> {
  if (initialized || initializing) return;
  initializing = true;

  try {
    // Dynamic import since node-llama-cpp is ESM-only
    const { getLlama } = await import('node-llama-cpp');

    llama = await getLlama();
    console.log('[llm] Llama runtime initialized');

    const modelPath = getLLMModelPath();
    console.log('[llm] Model path:', modelPath);

    model = await llama.loadModel({ modelPath });
    console.log('[llm] Model loaded');

    context = await model.createContext();
    const { LlamaChatSession } = await import('node-llama-cpp');
    session = new LlamaChatSession({
      contextSequence: context.getSequence(),
      systemPrompt: SYSTEM_PROMPT,
    });

    initialized = true;
    console.log('[llm] LLM engine ready');
  } catch (err) {
    console.error('[llm] Initialization failed:', err);
    throw err;
  } finally {
    initializing = false;
  }
}

export async function correctText(rawText: string): Promise<string> {
  if (!initialized || !session) {
    console.warn('[llm] LLM not initialized, returning raw text');
    return rawText;
  }

  try {
    const prompt = `Fix ASR errors in the following text. Output only the corrected text:\n\n${rawText}`;

    const corrected = await session.prompt(prompt, {
      temperature: 0.1,
      maxTokens: Math.max(rawText.length * 3, 100),
    });

    // Reset chat history for next independent correction
    session.setChatHistory([]);

    const result = corrected.trim();
    if (result) {
      console.log('[llm] Corrected:', rawText, '->', result);
      return result;
    }
    return rawText;
  } catch (err) {
    console.error('[llm] Correction failed:', err);
    return rawText;
  }
}

export function isLLMReady(): boolean {
  return initialized;
}
