import { NextRequest, NextResponse } from 'next/server';
import { getAllTemplates, createTemplate } from '@/lib/templates';
import type { TemplateCreateInput } from '@/types';

// GET /api/templates - List all templates
export async function GET() {
  try {
    const templates = getAllTemplates();

    return NextResponse.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST /api/templates - Create new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, schema, defaultValues } = body as TemplateCreateInput;

    // Validation
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!schema || typeof schema !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Schema must be a valid object' },
        { status: 400 }
      );
    }

    const template = createTemplate({
      name,
      description,
      schema,
      defaultValues,
    });

    return NextResponse.json(
      { success: true, data: template },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to create template:', error);

    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('UNIQUE constraint')) {
      return NextResponse.json(
        { success: false, error: 'A template with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
