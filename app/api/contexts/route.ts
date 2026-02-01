import { NextRequest, NextResponse } from 'next/server';
import {
  getAllContexts,
  createContext,
  searchContexts,
  getContextsByComplianceFilters,
} from '@/lib/contexts';
import type { ContextCreateInput, LineOfBusiness, DataClassification, RegulatoryHook } from '@/types';

// GET /api/contexts - List all contexts, search by q, or filter by compliance (lineOfBusiness, dataClassification, regulatoryHook)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const lineOfBusiness = searchParams.get('lineOfBusiness') as LineOfBusiness | null;
    const dataClassification = searchParams.get('dataClassification') as DataClassification | null;
    const regulatoryHook = searchParams.get('regulatoryHook') as RegulatoryHook | null;

    let contexts;
    if (query) {
      contexts = await searchContexts(query);
    } else if (lineOfBusiness || dataClassification || regulatoryHook) {
      contexts = await getContextsByComplianceFilters({
        ...(lineOfBusiness && { lineOfBusiness }),
        ...(dataClassification && { dataClassification }),
        ...(regulatoryHook && { regulatoryHook }),
      });
    } else {
      contexts = await getAllContexts();
    }

    return NextResponse.json({
      success: true,
      data: contexts,
    });
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

    // Check name format
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Name must contain only letters, numbers, hyphens, and underscores',
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
