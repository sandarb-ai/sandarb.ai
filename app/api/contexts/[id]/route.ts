import { NextRequest, NextResponse } from 'next/server';
import { getContextById, updateContext, deleteContext } from '@/lib/contexts';
import type { ContextUpdateInput } from '@/types';

// GET /api/contexts/:id - Get single context
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const context = await getContextById(id);

    if (!context) {
      return NextResponse.json(
        { success: false, error: 'Context not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: context });
  } catch (error) {
    console.error('Failed to fetch context:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch context' },
      { status: 500 }
    );
  }
}

// PUT /api/contexts/:id - Update context
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const {
      name,
      description,
      content,
      templateId,
      tags,
      isActive,
      lineOfBusiness,
      dataClassification,
      regulatoryHooks,
    } = body as ContextUpdateInput;

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

    // Validate content if provided
    if (content !== undefined && (typeof content !== 'object' || content === null)) {
      return NextResponse.json(
        { success: false, error: 'Content must be a valid object' },
        { status: 400 }
      );
    }

    const context = await updateContext(id, {
      name,
      description,
      content,
      templateId,
      tags,
      isActive,
      lineOfBusiness,
      dataClassification,
      regulatoryHooks,
    });

    if (!context) {
      return NextResponse.json(
        { success: false, error: 'Context not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: context });
  } catch (error) {
    console.error('Failed to update context:', error);

    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
      return NextResponse.json(
        { success: false, error: 'A context with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to update context' },
      { status: 500 }
    );
  }
}

// DELETE /api/contexts/:id - Delete context
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const deleted = await deleteContext(id);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Context not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Context deleted successfully',
    });
  } catch (error) {
    console.error('Failed to delete context:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete context' },
      { status: 500 }
    );
  }
}
