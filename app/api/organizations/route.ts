import { NextRequest, NextResponse } from 'next/server';
import {
  getAllOrganizations,
  getOrganizationsTree,
  getRootOrganization,
  createOrganization,
} from '@/lib/organizations';
import type { OrganizationCreateInput } from '@/types';

// GET /api/organizations - List all orgs or tree
export async function GET(request: NextRequest) {
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
    console.error('Failed to fetch organizations:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch organizations' },
      { status: 500 }
    );
  }
}

// POST /api/organizations - Create organization (sub-org under parent or root)
export async function POST(request: NextRequest) {
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
    console.error('Failed to create organization:', error);
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
}
