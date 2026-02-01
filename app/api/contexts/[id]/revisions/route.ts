import { NextRequest, NextResponse } from 'next/server';
import { getRevisionsByContextId } from '@/lib/revisions';
import { getContextById } from '@/lib/contexts';

// GET /api/contexts/:id/revisions - List revisions (git-like history)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const context = await getContextById(id);
    if (!context) {
      return NextResponse.json(
        { success: false, error: 'Context not found' },
        { status: 404 }
      );
    }
    const revisions = await getRevisionsByContextId(id);
    return NextResponse.json({ success: true, data: revisions });
  } catch (error) {
    console.error('Failed to fetch revisions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch revisions' },
      { status: 500 }
    );
  }
}

// POST /api/contexts/:id/revisions - Propose edit (commit message + content)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { content, commitMessage, createdBy } = body as {
      content: Record<string, unknown>;
      commitMessage?: string;
      createdBy?: string;
    };
    if (!content || typeof content !== 'object') {
      return NextResponse.json(
        { success: false, error: 'content is required' },
        { status: 400 }
      );
    }
    const { proposeRevision } = await import('@/lib/revisions');
    const revision = await proposeRevision({
      contextId: id,
      content,
      commitMessage,
      createdBy,
    });
    return NextResponse.json({ success: true, data: revision }, { status: 201 });
  } catch (error) {
    console.error('Failed to propose revision:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to propose revision' },
      { status: 500 }
    );
  }
}
