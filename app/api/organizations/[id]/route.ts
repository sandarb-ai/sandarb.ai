import { NextRequest, NextResponse } from 'next/server';
import {
  getOrganizationById,
  updateOrganization,
  deleteOrganization,
  getChildOrganizations,
} from '@/lib/organizations';
import type { OrganizationUpdateInput } from '@/types';

// GET /api/organizations/:id
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const org = await getOrganizationById(id);
    if (!org) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }
    const { searchParams } = new URL(request.url);
    const withChildren = searchParams.get('children') === 'true';
    const data = withChildren
      ? { ...org, children: await getChildOrganizations(id) }
      : org;
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Failed to fetch organization:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch organization' },
      { status: 500 }
    );
  }
}

// PUT /api/organizations/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json() as OrganizationUpdateInput;
    const org = await updateOrganization(id, body);
    if (!org) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, data: org });
  } catch (error) {
    console.error('Failed to update organization:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update organization' },
      { status: 500 }
    );
  }
}

// DELETE /api/organizations/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await deleteOrganization(id);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Organization not found or root cannot be deleted' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete organization:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete organization' },
      { status: 500 }
    );
  }
}
