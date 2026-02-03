import { NextRequest, NextResponse } from 'next/server';
import {
  getPromptById,
  getPromptVersionById,
  approvePromptVersion,
} from '@/lib/prompts';

// POST /api/prompts/:id/versions/:versionId/approve
// Governance: Approve a proposed prompt version, making it the current active version.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  try {
    const { id, versionId } = await params;
    const prompt = await getPromptById(id);
    if (!prompt) {
      return NextResponse.json(
        { success: false, error: 'Prompt not found' },
        { status: 404 }
      );
    }

    const version = await getPromptVersionById(versionId);
    if (!version) {
      return NextResponse.json(
        { success: false, error: 'Version not found' },
        { status: 404 }
      );
    }

    if (version.promptId !== id) {
      return NextResponse.json(
        { success: false, error: 'Version does not belong to this prompt' },
        { status: 400 }
      );
    }

    if (version.status !== 'proposed') {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot approve version with status '${version.status}'. Only proposed versions can be approved.`,
        },
        { status: 400 }
      );
    }

    // Extract approver from request body or headers
    const body = await request.json().catch(() => ({}));
    const approvedBy = body.approvedBy ?? request.headers.get('x-user-id') ?? undefined;

    const approvedVersion = await approvePromptVersion(versionId, approvedBy);

    if (!approvedVersion) {
      return NextResponse.json(
        { success: false, error: 'Failed to approve version' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: approvedVersion,
      message: `Version ${approvedVersion.version} approved and set as current version for prompt '${prompt.name}'`,
    });
  } catch (error) {
    console.error('Failed to approve prompt version:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to approve prompt version' },
      { status: 500 }
    );
  }
}
