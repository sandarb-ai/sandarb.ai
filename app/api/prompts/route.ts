import { NextRequest, NextResponse } from 'next/server';
import {
  getAllPrompts,
  createPrompt,
  getPromptByName,
  createPromptVersion,
} from '@/lib/prompts';
import { withSpan, logger } from '@/lib/otel';

// GET /api/prompts - List all prompts
export async function GET(request: NextRequest) {
  return withSpan('GET /api/prompts', async () => {
    try {
      const { searchParams } = new URL(request.url);
      const tags = searchParams.get('tags')?.split(',').filter(Boolean);

      let prompts = await getAllPrompts();

      if (tags && tags.length > 0) {
        prompts = prompts.filter(p =>
          tags.some(t => p.tags.includes(t))
        );
      }

      return NextResponse.json({
        success: true,
        data: prompts,
      });
    } catch (error) {
      logger.error('Failed to fetch prompts', { route: 'GET /api/prompts', error: String(error) });
      return NextResponse.json(
        { success: false, error: 'Failed to fetch prompts' },
        { status: 500 }
      );
    }
  });
}

// POST /api/prompts - Create new prompt with initial version
export async function POST(request: NextRequest) {
  return withSpan('POST /api/prompts', async () => {
  try {
    const body = await request.json();
    const {
      name,
      description,
      projectId,
      tags,
      content,
      variables,
      model,
      temperature,
      maxTokens,
      systemPrompt,
      commitMessage,
      autoApprove = true, // Default to true for new prompts (backward compat)
    } = body;

    // Validation
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Content is required' },
        { status: 400 }
      );
    }

    // Check name format (lowercase alphanumeric, hyphens, underscores only)
    if (!/^[a-z0-9_-]+$/.test(name)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Name must be lowercase and contain only letters, numbers, hyphens (-), and underscores (_)',
        },
        { status: 400 }
      );
    }

    // Check if prompt already exists
    const existing = await getPromptByName(name);
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A prompt with this name already exists' },
        { status: 409 }
      );
    }

    // Create prompt
    const prompt = await createPrompt({
      name,
      description,
      projectId,
      tags,
    });

    // Create initial version
    const version = await createPromptVersion({
      promptId: prompt.id,
      content,
      variables: variables || [],
      model,
      temperature,
      maxTokens,
      systemPrompt,
      commitMessage: commitMessage || 'Initial version',
      autoApprove, // Governance: auto-approve or require review
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          ...prompt,
          currentVersion: version,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    logger.error('Failed to create prompt', { route: 'POST /api/prompts', error: String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to create prompt' },
      { status: 500 }
    );
  }
  });
}
