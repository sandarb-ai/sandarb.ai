import { NextRequest, NextResponse } from 'next/server';
import {
  getAllContexts,
  getContextsPaginated,
  createContext,
  searchContexts,
  getContextsByComplianceFilters,
} from '@/lib/contexts';
import type { ContextCreateInput, LineOfBusiness, DataClassification, RegulatoryHook } from '@/types';

// GET /api/contexts - List contexts; optional limit/offset for pagination; search by q or filter by compliance
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const lineOfBusiness = searchParams.get('lineOfBusiness') as LineOfBusiness | null;
    const dataClassification = searchParams.get('dataClassification') as DataClassification | null;
    const regulatoryHook = searchParams.get('regulatoryHook') as RegulatoryHook | null;
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 200) : 0;
    const offset = offsetParam ? Math.max(0, parseInt(offsetParam, 10)) : 0;
    const usePagination = limit > 0;

    if (query) {
      const contexts = await searchContexts(query);
      return NextResponse.json({ success: true, data: contexts, total: contexts.length });
    }
    if (lineOfBusiness || dataClassification || regulatoryHook) {
      const contexts = await getContextsByComplianceFilters({
        ...(lineOfBusiness && { lineOfBusiness }),
        ...(dataClassification && { dataClassification }),
        ...(regulatoryHook && { regulatoryHook }),
      });
      return NextResponse.json({ success: true, data: contexts, total: contexts.length });
    }
    if (usePagination) {
      const { contexts, total } = await getContextsPaginated(limit, offset);
      return NextResponse.json({ success: true, data: contexts, total });
    }
    const contexts = await getAllContexts();
    return NextResponse.json({ success: true, data: contexts, total: contexts.length });
  } catch (error) {
    console.error('Failed to fetch contexts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch contexts' },
      { status: 500 }
    );
  }
}

// POST /api/contexts - Create new context
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      description,
      content,
      templateId,
      tags,
      lineOfBusiness,
      dataClassification,
      regulatoryHooks,
    } = body as ContextCreateInput;

    // Validation
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!content || typeof content !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Content must be a valid object' },
        { status: 400 }
      );
    }

    // Check name format (lowercase alphanumeric, hyphens, underscores only)
    if (!/^[a-z0-9_-]+$/.test(name)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Name must be lowercase and contain only letters, numbers, hyphens (-), and underscores (_)',
        },
        { status: 400 }
      );
    }

    const context = await createContext({
      name,
      description,
      content,
      templateId,
      tags,
      lineOfBusiness,
      dataClassification,
      regulatoryHooks,
    });

    return NextResponse.json(
      { success: true, data: context },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create context:', error);

    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
      return NextResponse.json(
        { success: false, error: 'A context with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create context' },
      { status: 500 }
    );
  }
}
