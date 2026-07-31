// ============================================================
// GHOST PM — AI Response Envelope Parser & Validator
// ============================================================

import { ResponseEnvelopeSchema, ARTIFACT_SCHEMAS, type ResponseEnvelope } from './schemas';
import type { ArtifactType } from '@/lib/types';

export interface ParseResult {
  success: boolean;
  data?: ResponseEnvelope;
  error?: string;
}

/**
 * Parse and validate an AI response string into a typed envelope.
 * Falls back to a note artifact if validation fails.
 */
export function parseAIResponse(rawResponse: string): ParseResult {
  try {
    // Clean response — strip markdown code fences if present
    let cleaned = rawResponse.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned);
    const envelope = ResponseEnvelopeSchema.parse(parsed);

    // Validate each artifact's content against its type-specific schema
    for (const artifact of envelope.artifacts) {
      const schema = ARTIFACT_SCHEMAS[artifact.artifact_type as ArtifactType];
      if (schema) {
        try {
          schema.parse(artifact.content);
        } catch {
          // Content doesn't match schema — demote to note
          console.warn(
            `Artifact "${artifact.title}" failed ${artifact.artifact_type} validation, demoting to note`
          );
          artifact.artifact_type = 'note';
          artifact.content = {
            text: JSON.stringify(artifact.content, null, 2),
          };
        }
      }
    }

    return { success: true, data: envelope };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown parse error';
    
    // Fallback: wrap the raw response in a note artifact
    return {
      success: true,
      data: {
        chat_reply: rawResponse.slice(0, 200),
        artifacts: [
          {
            id: `fallback-${Date.now()}`,
            artifact_type: 'note',
            title: 'AI Response',
            version: 1,
            content: { text: rawResponse },
          },
        ],
      },
      error: `Parse failed (fallback used): ${message}`,
    };
  }
}

/**
 * Validate a specific artifact content against its type schema.
 */
export function validateArtifactContent(
  type: ArtifactType,
  content: Record<string, unknown>
): { valid: boolean; error?: string } {
  const schema = ARTIFACT_SCHEMAS[type];
  if (!schema) {
    return { valid: false, error: `Unknown artifact type: ${type}` };
  }
  try {
    schema.parse(content);
    return { valid: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Validation failed';
    return { valid: false, error: message };
  }
}
