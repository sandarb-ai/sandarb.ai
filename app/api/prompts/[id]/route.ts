import { NextRequest, NextResponse } from 'next/server';
import {
  getPromptById,
  updatePrompt,
  deletePrompt,
  getPromptVersions,
  getCurrentPromptVersion,
} from '@/lib/prompts';

interface RouteParams {
  params: { id: string };
}

// GET /api/prompts/:id - Get prompt with versions
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const prompt = getPromptById(params.id);

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt not found' },
        { status: 404 }
      );
    }

    const versions = getPromptVersions(prompt.id);
    const currentVersion = getCurrentPromptVersion(prompt.id);

    return NextResponse.json({
      success: true,
      data: {
        ...prompt,
        currentVersion,
        versions,
      },
    });
  } catch (error) {
    console.error('Failed to fetch prompt:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch prompt' },
      { status: 500 }
    );
  }
}

// PUT /api/prompts/:id - Update prompt metadata
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const body = await request.json();
    const { name, description, currentVersionId, projectId, tags } = body;

    // Validate name format if provided
    if (name && !/^[a-zA-Z0-9_-]+$/.test(name)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Name must contain only letters, numbers, hyphens, and underscores',
        },
        { status: 400 }
      );
    }

    const prompt = updatePrompt(params.id, {
      name,
      description,
      currentVersionId,
      projectId,
      tags,
    });

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: prompt });
  } catch (error) {
    console.error('Failed to update prompt:', error);

    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
      return NextResponse.json(
        { success: false, error: 'A prompt with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update prompt' },
      { status: 500 }
    );
  }
}

// DELETE /api/prompts/:id - Delete prompt and all versions
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const deleted = deletePrompt(params.id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Prompt not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Prompt deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete prompt:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete prompt' },
      { status: 500 }
    );
  }
}
