// ============================================================
// GHOST PM — Brainstorm AI Moderation Route
// ============================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateContentWithRetry } from '@/lib/ai/client';
import { parseAIResponse } from '@/lib/ai/envelope';
import { getBrainstormModeratorPrompt } from '@/lib/ai/prompts';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, sessionId, recentMessages, anchorText, trigger } = body;

    if (!teamId || !sessionId) {
      return NextResponse.json(
        { error: 'teamId and sessionId are required' },
        { status: 400 }
      );
    }

    // Fetch team context
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const systemPrompt = getBrainstormModeratorPrompt(
      team,
      anchorText || 'No anchor set'
    );

    let userPrompt = `Trigger: ${trigger || 'drift_check'}\n\nRecent discussion:\n`;
    if (recentMessages && Array.isArray(recentMessages)) {
      recentMessages.forEach(
        (msg: { content: string; is_ai: boolean }, i: number) => {
          const sender = msg.is_ai ? 'AI' : 'Team Member';
          userPrompt += `[${sender}]: ${msg.content}\n`;
        }
      );
    }

    const rawResponse = await generateContentWithRetry({
      systemPrompt,
      userPrompt,
      temperature: 0.3,
      maxTokens: 2048,
      jsonMode: true,
    });

    const parsed = parseAIResponse(rawResponse);

    if (!parsed.data) {
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    // Check for nudge artifacts
    const nudgeArtifact = parsed.data.artifacts.find(
      (a) => a.artifact_type === 'nudge'
    );

    if (nudgeArtifact) {
      const content = nudgeArtifact.content as {
        reason?: string;
        severity?: string;
        suggestion?: string;
        classification?: string;
      };

      // Save nudge to database
      await supabase.from('nudges').insert({
        team_id: teamId,
        session_id: sessionId,
        reason: content.reason || 'Discussion may need redirection',
        severity: content.severity || 'info',
        suggestion: content.suggestion || null,
      });

      // Update session classification
      await supabase
        .from('brainstorm_sessions')
        .update({
          last_drift_check_at: new Date().toISOString(),
          last_classification: content.classification || 'on_track',
        })
        .eq('id', sessionId);
    } else {
      // Update classification even when no nudge
      await supabase
        .from('brainstorm_sessions')
        .update({
          last_drift_check_at: new Date().toISOString(),
          last_classification: 'on_track',
        })
        .eq('id', sessionId);
    }

    // Save AI message to brainstorm
    if (parsed.data.chat_reply && parsed.data.chat_reply.trim()) {
      await supabase.from('brainstorm_messages').insert({
        session_id: sessionId,
        team_id: teamId,
        is_ai: true,
        content: parsed.data.chat_reply,
      });
    }

    // Save any artifacts
    for (const artifact of parsed.data.artifacts) {
      await supabase.from('artifacts').insert({
        team_id: teamId,
        session_id: sessionId,
        artifact_type: artifact.artifact_type,
        title: artifact.title,
        version: artifact.version,
        content: artifact.content,
      });
    }

    return NextResponse.json({
      chat_reply: parsed.data.chat_reply,
      artifacts: parsed.data.artifacts,
    });
  } catch (error) {
    console.error('Brainstorm AI error:', error);
    return NextResponse.json(
      { error: 'AI moderation failed' },
      { status: 500 }
    );
  }
}
