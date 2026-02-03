import { NextRequest, NextResponse } from 'next/server';
import {
  getPromptById,
  getPromptVersionById,
  rejectPromptVersion,
} from '@/lib/prompts';
import { withSpan, logger } from '@/lib/otel';

// POST /api/prompts/:id/versions/:versionId/reject
// Governance: Reject a proposed prompt version.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  return withSpan('POST /api/prompts/[id]/versions/[versionId]/reject', async () => {
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
          error: `Cannot reject version with status '${version.status}'. Only proposed versions can be rejected.`,
        },
        { status: 400 }
      );
    }

    // Extract rejector and reason from request body or headers
    const body = await request.json().catch(() => ({}));
    const rejectedBy = body.rejectedBy ?? request.headers.get('x-user-id') ?? undefined;
    const reason = body.reason;

    const rejectedVersion = await rejectPromptVersion(versionId, rejectedBy);

    if (!rejectedVersion) {
      return NextResponse.json(
        { success: false, error: 'Failed to reject version' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: rejectedVersion,
      message: `Version ${rejectedVersion.version} rejected for prompt '${prompt.name}'${reason ? `: ${reason}` : ''}`,
    });
  } catch (error) {
    logger.error('Failed to reject prompt version', { route: 'POST /api/prompts/[id]/versions/[versionId]/reject', error: String(error) });
    return NextResponse.json(
      { success: false, error: 'Failed to reject prompt version' },
      { status: 500 }
    );
  }
  });
}
