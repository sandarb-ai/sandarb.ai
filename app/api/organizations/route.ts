import { NextRequest, NextResponse } from 'next/server';
import {
  getAllOrganizations,
  getOrganizationsTree,
  getRootOrganization,
  createOrganization,
} from '@/lib/organizations';
import type { OrganizationCreateInput } from '@/types';
import { withSpan, logger } from '@/lib/otel';

// GET /api/organizations - List all orgs or tree
export async function GET(request: NextRequest) {
  return withSpan('GET /api/organizations', async () => {
    try {
      const { searchParams } = new URL(request.url);
      const tree = searchParams.get('tree') === 'true';
      const rootOnly = searchParams.get('root') === 'true';

      if (rootOnly) {
        const root = await getRootOrganization();
        return NextResponse.json({ success: true, data: root });
      }

      if (tree) {
        const treeData = await getOrganizationsTree();
        return NextResponse.json({ success: true, data: treeData });
      }

      const orgs = await getAllOrganizations();
      return NextResponse.json({ success: true, data: orgs });
    } catch (error) {
      logger.error('Failed to fetch organizations', { route: 'GET /api/organizations', error: String(error) });
      return NextResponse.json(
        { success: false, error: 'Failed to fetch organizations' },
        { status: 500 }
      );
    }
  });
}

// POST /api/organizations - Create organization (sub-org under parent or root)
export async function POST(request: NextRequest) {
  return withSpan('POST /api/organizations', async () => {
    try {
      const body = await request.json();
      const { name, slug, description, parentId } = body as OrganizationCreateInput;

      if (!name || typeof name !== 'string') {
        return NextResponse.json(
          { success: false, error: 'Name is required' },
          { status: 400 }
        );
      }

      const org = await createOrganization({
        name,
        slug,
        description,
        parentId: parentId ?? null,
      });

      return NextResponse.json({ success: true, data: org }, { status: 201 });
    } catch (error) {
      logger.error('Failed to create organization', { route: 'POST /api/organizations', error: String(error) });
      if (error instanceof Error && error.message.includes('UNIQUE')) {
        return NextResponse.json(
          { success: false, error: 'An organization with this slug already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Failed to create organization' },
        { status: 500 }
      );
    }
  });
}
