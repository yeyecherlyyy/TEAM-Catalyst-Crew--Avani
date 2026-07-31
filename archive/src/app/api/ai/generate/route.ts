// ============================================================
// GHOST PM — AI Generate Route (Roadmap, Brief, Flowchart)
// ============================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateContentWithRetry } from '@/lib/ai/client';
import { parseAIResponse } from '@/lib/ai/envelope';
import {
  getRoadmapGeneratorPrompt,
  getBriefGeneratorPrompt,
  getFlowchartGeneratorPrompt,
  getComparisonPrompt,
  getProgressAnalysisPrompt,
} from '@/lib/ai/prompts';

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
    const { teamId, type, ideaDescription, sessionId, extraData } = body;

    if (!teamId || !type) {
      return NextResponse.json(
        { error: 'teamId and type are required' },
        { status: 400 }
      );
    }

    // Fetch team
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();

    if (teamError || !team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    let systemPrompt: string;
    let userPrompt: string = ideaDescription || 'No idea description provided';

    switch (type) {
      case 'roadmap':
        systemPrompt = getRoadmapGeneratorPrompt(team, ideaDescription || '');
        userPrompt = `Generate a phased roadmap for this idea:\n${ideaDescription}`;
        break;
      case 'brief':
        systemPrompt = getBriefGeneratorPrompt(team, ideaDescription || '');
        userPrompt = `Generate a structured one-page brief:\n${ideaDescription}`;
        break;
      case 'flowchart':
        systemPrompt = getFlowchartGeneratorPrompt(team, ideaDescription || '');
        userPrompt = `Generate an architecture/user flow diagram:\n${ideaDescription}`;
        break;
      case 'comparison':
        systemPrompt = getComparisonPrompt(team);
        userPrompt = `Compare these problem statements:\n${ideaDescription}`;
        break;
      case 'progress':
        systemPrompt = getProgressAnalysisPrompt(
          team,
          extraData?.predictedPercent || 0,
          extraData?.actualPercent || 0,
          extraData?.hoursElapsed || 0,
          extraData?.totalHours || 24
        );
        userPrompt = `Analyze our current progress and provide feedback.`;
        break;
      default:
        return NextResponse.json(
          { error: `Unknown generation type: ${type}` },
          { status: 400 }
        );
    }

    const rawResponse = await generateContentWithRetry({
      systemPrompt,
      userPrompt,
      temperature: 0.5,
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

    // Save artifacts to database
    for (const artifact of parsed.data.artifacts) {
      await supabase.from('artifacts').insert({
        team_id: teamId,
        session_id: sessionId || null,
        artifact_type: artifact.artifact_type,
        title: artifact.title,
        version: artifact.version,
        content: artifact.content,
      });
    }

    // If roadmap, save to roadmaps table
    if (type === 'roadmap') {
      const roadmapArtifact = parsed.data.artifacts.find(
        (a) => a.artifact_type === 'roadmap'
      );
      if (roadmapArtifact) {
        const content = roadmapArtifact.content as {
          phases?: Array<{
            name: string;
            description: string;
            predicted_hours: number;
            tasks: Array<{ title: string; description?: string; predicted_hours?: number }>;
          }>;
          total_hours?: number;
        };

        const { data: roadmap } = await supabase
          .from('roadmaps')
          .insert({
            team_id: teamId,
            title: roadmapArtifact.title,
            phases: content.phases || [],
            total_predicted_hours: content.total_hours || null,
          })
          .select()
          .single();

        // Create roadmap tasks
        if (roadmap && content.phases) {
          const tasks = content.phases.flatMap(
            (phase, phaseIndex) =>
              phase.tasks?.map((task) => ({
                roadmap_id: roadmap.id,
                team_id: teamId,
                phase_index: phaseIndex,
                title: task.title,
                description: task.description || null,
                predicted_hours: task.predicted_hours || null,
              })) || []
          );

          if (tasks.length > 0) {
            await supabase.from('roadmap_tasks').insert(tasks);
          }
        }
      }
    }

    return NextResponse.json({
      chat_reply: parsed.data.chat_reply,
      artifacts: parsed.data.artifacts,
    });
  } catch (error) {
    console.error('AI Generate error:', error);
    return NextResponse.json(
      { error: 'AI generation failed. Please try again.' },
      { status: 500 }
    );
  }
}
