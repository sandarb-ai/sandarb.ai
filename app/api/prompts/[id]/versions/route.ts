import { NextRequest, NextResponse } from 'next/server';
import {
  getPromptById,
  getPromptVersions,
  createPromptVersion,
  updatePrompt,
} from '@/lib/prompts';

interface RouteParams {
  params: { id: string };
}

// GET /api/prompts/:id/versions - List all versions
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const prompt = getPromptById(params.id);

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt not found' },
        { status: 404 }
      );
    }

    const versions = getPromptVersions(params.id);

    return NextResponse.json({
      success: true,
      data: versions,
    });
  } catch (error) {
    console.error('Failed to fetch versions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch versions' },
      { status: 500 }
    );
  }
}

// POST /api/prompts/:id/versions - Create new version
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const prompt = getPromptById(params.id);

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      content,
      variables,
      model,
      temperature,
      maxTokens,
      systemPrompt,
      metadata,
      commitMessage,
      createdBy,
      setAsCurrent,
    } = body;

    // Validation
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Content is required' },
        { status: 400 }
      );
    }

    // Create the version
    const version = createPromptVersion({
      promptId: params.id,
      content,
      variables,
      model,
      temperature,
      maxTokens,
      systemPrompt,
      metadata,
      commitMessage,
      createdBy,
    });

    // Set as current if requested (default is true)
    if (setAsCurrent !== false) {
      updatePrompt(params.id, { currentVersionId: version.id });
    }

    return NextResponse.json(
      { success: true, data: version },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create version:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create version' },
      { status: 500 }
    );
  }
}
