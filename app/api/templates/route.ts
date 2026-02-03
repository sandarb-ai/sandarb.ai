import { NextRequest, NextResponse } from 'next/server';
import { getAllTemplates, createTemplate } from '@/lib/templates';
import type { TemplateCreateInput } from '@/types';
import { withSpan, logger } from '@/lib/otel';

// GET /api/templates - List all templates
export async function GET() {
  return withSpan('GET /api/templates', async () => {
    try {
      const templates = await getAllTemplates();

      return NextResponse.json({
        success: true,
        data: templates,
      });
    } catch (error) {
      logger.error('Failed to fetch templates', { route: 'GET /api/templates', error: String(error) });
      return NextResponse.json(
        { success: false, error: 'Failed to fetch templates' },
        { status: 500 }
      );
    }
  });
}

// POST /api/templates - Create new template
export async function POST(request: NextRequest) {
  return withSpan('POST /api/templates', async () => {
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

      const template = await createTemplate({
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
      logger.error('Failed to create template', { route: 'POST /api/templates', error: String(error) });
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
  });
}
