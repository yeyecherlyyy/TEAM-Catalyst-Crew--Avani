// ============================================================
// GHOST PM — Web Search API Route (Tavily)
// ============================================================

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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
    const { query } = body;

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const tavilyKey = process.env.TAVILY_API_KEY;
    if (!tavilyKey) {
      // Fallback: return empty results if no Tavily key
      return NextResponse.json({
        results: [],
        message: 'Web search not configured. Set TAVILY_API_KEY to enable prior art search.',
      });
    }

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: tavilyKey,
        query: `hackathon project "${query}" existing solutions`,
        search_depth: 'basic',
        max_results: 8,
        include_answer: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Tavily API error:', errorText);
      return NextResponse.json({
        results: [],
        message: 'Web search failed. Results may be incomplete.',
      });
    }

    const data = await response.json();
    const results = (data.results || []).map(
      (r: { title: string; url: string; content: string }) => ({
        title: r.title,
        url: r.url,
        description: r.content?.slice(0, 200) || '',
        relevance: 'Found via web search',
      })
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({
      results: [],
      message: 'Search failed. Proceeding without prior art data.',
    });
  }
}
