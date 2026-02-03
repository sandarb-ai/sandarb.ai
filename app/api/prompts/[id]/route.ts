import { NextRequest, NextResponse } from 'next/server';
import {
  getPromptById,
  updatePrompt,
  deletePrompt,
  getPromptVersions,
  getCurrentPromptVersion,
} from '@/lib/prompts';

// GET /api/prompts/:id - Get prompt with versions
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const prompt = await getPromptById(id);

    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt not found' },
        { status: 404 }
      );
    }

    const versions = await getPromptVersions(id);
    const currentVersion = await getCurrentPromptVersion(id);

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
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, currentVersionId, projectId, tags } = body;

    // Validate name format if provided (lowercase alphanumeric, hyphens, underscores only)
    if (name && !/^[a-z0-9_-]+$/.test(name)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Name must be lowercase and contain only letters, numbers, hyphens (-), and underscores (_)',
        },
        { status: 400 }
      );
    }

    const prompt = await updatePrompt(id, {
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
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const deleted = await deletePrompt(id);

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
