import { NextRequest, NextResponse } from 'next/server';
import {
  getPromptById,
  getPromptVersions,
  createPromptVersion,
} from '@/lib/prompts';

// GET /api/prompts/:id/versions - List all versions
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
// Governance: versions are created as 'proposed' by default and require approval.
// Set autoApprove: true for backward compatibility (immediate approval).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const prompt = await getPromptById(id);

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
      autoApprove, // New: if true, version is immediately approved
      setAsCurrent, // Deprecated: use autoApprove instead
    } = body;

    // Validation
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Content is required' },
        { status: 400 }
      );
    }

    // Backward compatibility: setAsCurrent=true implies autoApprove=true
    const shouldAutoApprove = autoApprove ?? (setAsCurrent !== false);

    // Create the version with governance workflow
    const version = await createPromptVersion({
      promptId: id,
      content,
      variables,
      model,
      temperature,
      maxTokens,
      systemPrompt,
      metadata,
      commitMessage,
      createdBy,
      autoApprove: shouldAutoApprove,
    });

    return NextResponse.json(
      {
        success: true,
        data: version,
        message: shouldAutoApprove
          ? 'Version created and approved'
          : 'Version created as proposed. Requires approval before it becomes active.',
      },
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
