// ============================================================
// GHOST PM — AI Rating API Route
// ============================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateContentWithRetry } from '@/lib/ai/client';
import { parseAIResponse } from '@/lib/ai/envelope';
import { getProblemAdvisorPrompt } from '@/lib/ai/prompts';
import { getWeights, calculateComposite } from '@/lib/ai/weights';

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
    const { teamId, problemStatementId, title, description, priorArt } = body;

    if (!teamId || !title) {
      return NextResponse.json(
        { error: 'teamId and title are required' },
        { status: 400 }
      );
    }

    // Fetch team for context
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    const weights = getWeights(team.hackathon_format);
    const systemPrompt = getProblemAdvisorPrompt(team, weights);

    let userPrompt = `Rate this problem statement:\n\nTitle: ${title}`;
    if (description) {
      userPrompt += `\nDescription: ${description}`;
    }
    if (priorArt && priorArt.length > 0) {
      userPrompt += `\n\nPrior Art / Existing Solutions Found:\n`;
      priorArt.forEach(
        (item: { title: string; url: string; description: string }, i: number) => {
          userPrompt += `${i + 1}. ${item.title} (${item.url}): ${item.description}\n`;
        }
      );
    }

    // Generate AI response
    const rawResponse = await generateContentWithRetry({
      systemPrompt,
      userPrompt,
      temperature: 0.3,
      maxTokens: 4096,
      jsonMode: true,
    });

    const parsed = parseAIResponse(rawResponse);

    if (!parsed.data) {
      return NextResponse.json(
        { error: 'Failed to parse AI response' },
        { status: 500 }
      );
    }

    // Extract scorecard from artifacts
    const scorecard = parsed.data.artifacts.find(
      (a) => a.artifact_type === 'scorecard'
    );

    if (scorecard && problemStatementId) {
      const content = scorecard.content as {
        axes?: { name: string; score: number; justification: string }[];
        recommendation?: string;
      };
      const axes = content.axes || [];

      const scores = {
        uniqueness: axes.find((a) => a.name === 'uniqueness')?.score || 5,
        innovation: axes.find((a) => a.name === 'innovation')?.score || 5,
        scalability: axes.find((a) => a.name === 'scalability')?.score || 5,
        feasibility: axes.find((a) => a.name === 'feasibility')?.score || 5,
        competition: axes.find((a) => a.name === 'competition')?.score || 5,
        judging_fit: axes.find((a) => a.name === 'judging_fit')?.score || 5,
      };

      const composite = calculateComposite(scores, weights);

      // Save rating to database
      await supabase.from('ratings').insert({
        problem_statement_id: problemStatementId,
        team_id: teamId,
        ...scores,
        composite,
        justifications: Object.fromEntries(
          axes.map((a) => [a.name, a.justification])
        ),
        weighting_profile: weights,
        prior_art: priorArt || [],
        recommendation: content.recommendation || '',
      });

      // Save artifact
      await supabase.from('artifacts').insert({
        team_id: teamId,
        artifact_type: 'scorecard',
        title: `Rating: ${title}`,
        version: 1,
        content: scorecard.content,
      });
    }

    return NextResponse.json({
      chat_reply: parsed.data.chat_reply,
      artifacts: parsed.data.artifacts,
    });
  } catch (error) {
    console.error('AI Rate error:', error);
    return NextResponse.json(
      { error: 'AI rating failed. Please try again.' },
      { status: 500 }
    );
  }
}
