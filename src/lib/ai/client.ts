// ============================================================
// GHOST PM — Gemini AI Client Abstraction
// ============================================================

import { GoogleGenAI } from '@google/genai';
import { AI_MODEL, AI_EMBEDDING_MODEL } from '@/lib/constants';

let aiClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

export interface GenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

/**
 * Generate content using Gemini.
 * When jsonMode is true, forces JSON output.
 */
export async function generateContent(options: GenerateOptions): Promise<string> {
  const client = getClient();
  const { systemPrompt, userPrompt, temperature = 0.7, maxTokens = 4096, jsonMode = true } = options;

  const response = await client.models.generateContent({
    model: AI_MODEL,
    contents: userPrompt,
    config: {
      systemInstruction: systemPrompt,
      temperature,
      maxOutputTokens: maxTokens,
      ...(jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Empty response from Gemini');
  }
  return text;
}

/**
 * Generate embedding vector for text using Gemini Embedding model.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const client = getClient();

  const response = await client.models.embedContent({
    model: AI_EMBEDDING_MODEL,
    contents: text,
  });

  const embedding = response.embeddings?.[0]?.values;
  if (!embedding) {
    throw new Error('Failed to generate embedding');
  }
  return embedding;
}

/**
 * Generate content with retry logic and exponential backoff.
 * Handles rate limiting (429) errors.
 */
export async function generateContentWithRetry(
  options: GenerateOptions,
  maxRetries: number = 3
): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await generateContent(options);
    } catch (error: unknown) {
      lastError = error as Error;
      const message = lastError.message || '';
      // Rate limited — exponential backoff
      if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      // Other errors — don't retry
      throw error;
    }
  }
  throw lastError || new Error('Max retries exceeded');
}
