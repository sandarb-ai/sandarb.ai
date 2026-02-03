import { NextRequest, NextResponse } from 'next/server';
import { getAllProposedPromptVersions, getPromptById } from '@/lib/prompts';

/**
 * GET /api/prompts/pending
 * 
 * Get all prompt versions pending approval.
 * Use this for governance dashboards to show prompts awaiting review.
 */
export async function GET(request: NextRequest) {
  try {
    const versions = await getAllProposedPromptVersions();

    // Enrich with prompt metadata
    const enrichedVersions = await Promise.all(
      versions.map(async (v) => {
        const prompt = await getPromptById(v.promptId);
        return {
          ...v,
          promptName: prompt?.name ?? 'unknown',
          promptDescription: prompt?.description ?? null,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: enrichedVersions,
      meta: {
        count: enrichedVersions.length,
        description: 'Prompt versions pending approval (status: proposed)',
      },
    });
  } catch (error) {
    console.error('Failed to fetch pending prompt versions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pending prompt versions' },
      { status: 500 }
    );
  }
}
