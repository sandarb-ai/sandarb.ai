import { NextRequest, NextResponse } from 'next/server';
import {
  getAllPrompts,
  createPrompt,
  getPromptByName,
  createPromptVersion,
} from '@/lib/prompts';

// GET /api/prompts - List all prompts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);

    let prompts = getAllPrompts();

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
    console.error('Failed to fetch prompts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch prompts' },
      { status: 500 }
    );
  }
}

// POST /api/prompts - Create new prompt with initial version
export async function POST(request: NextRequest) {
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

    // Check name format
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Name must contain only letters, numbers, hyphens, and underscores',
        },
        { status: 400 }
      );
    }

    // Check if prompt already exists
    const existing = getPromptByName(name);
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'A prompt with this name already exists' },
        { status: 409 }
      );
    }

    // Create prompt
    const prompt = createPrompt({
      name,
      description,
      projectId,
      tags,
    });

    // Create initial version
    const version = createPromptVersion({
      promptId: prompt.id,
      content,
      variables: variables || [],
      model,
      temperature,
      maxTokens,
      systemPrompt,
      commitMessage: commitMessage || 'Initial version',
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
    console.error('Failed to create prompt:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create prompt' },
      { status: 500 }
    );
  }
}
