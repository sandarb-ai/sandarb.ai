'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiUrl } from '@/lib/api';
import { ArrowLeft, Plus, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Breadcrumb } from '@/components/ui/breadcrumb';

// Validate name: lowercase alphanumeric, hyphens, underscores only
const isValidName = (n: string) => /^[a-z0-9_-]+$/.test(n);
const NAME_ERROR = 'Name must be lowercase and contain only letters, numbers, hyphens (-), and underscores (_)';

export default function NewPromptPage() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState('');
  const [commitMessage, setCommitMessage] = useState('Initial version');
  const [autoApprove, setAutoApprove] = useState(true);

  const handleNameChange = (value: string) => {
    setName(value);
    if (value && !isValidName(value)) {
      setNameError(NAME_ERROR);
    } else {
      setNameError('');
    }
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      alert('Name is required');
      return;
    }
    if (!isValidName(name.trim())) {
      setNameError(NAME_ERROR);
      return;
    }
    if (!content.trim()) {
      alert('Content is required');
      return;
    }

    setCreating(true);
    try {
      const res = await fetch(apiUrl('/api/prompts'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
          content,
          systemPrompt: systemPrompt.trim() || undefined,
          model: model.trim() || undefined,
          commitMessage: commitMessage.trim() || 'Initial version',
          autoApprove,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        router.push(`/prompts/${data.data.id}`);
      } else {
        alert(data.error || 'Failed to create prompt');
      }
    } catch {
      alert('Failed to create prompt');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div className="flex items-center gap-4">
          <div>
            <Breadcrumb items={[{ label: 'Prompts', href: '/prompts' }, { label: 'New prompt' }]} className="mb-2" />
            <h1 className="text-2xl font-semibold tracking-tight">Create Agent Prompt</h1>
            <p className="text-sm text-muted-foreground">
              The "Employee Handbook" for agents: instructions on behavior, tone, and rules.
            </p>
          </div>
        </div>
        <Button onClick={handleCreate} disabled={creating || !name || !content || !!nameError}>
          <Plus className="h-4 w-4 mr-2" />
          {creating ? 'Creating...' : 'Create Prompt'}
        </Button>
      </header>

      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-3xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Prompt Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="my-agent-prompt"
                  className={`font-mono ${nameError ? 'border-destructive' : ''}`}
                />
                {nameError ? (
                  <p className="text-xs text-destructive">{nameError}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Lowercase letters, numbers, hyphens (-), and underscores (_) only. This is the unique identifier.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="What this prompt is for..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="customer-support, safety, v1"
                />
                <p className="text-xs text-muted-foreground">
                  Comma-separated labels for organization.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Initial Version</CardTitle>
              <p className="text-sm text-muted-foreground">
                The first version of the prompt content. You can create more versions later.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="content">Prompt Content *</Label>
                <Textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                  placeholder="You are a helpful customer support assistant for Acme Corp.

Your responsibilities:
1. Answer product questions accurately
2. Help with order status inquiries
3. Escalate complex issues to human agents

Always be polite and professional. Never make promises about refunds without manager approval."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="systemPrompt">System Prompt (optional)</Label>
                <Textarea
                  id="systemPrompt"
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={3}
                  className="font-mono text-sm"
                  placeholder="System-level instructions that override user input..."
                />
                <p className="text-xs text-muted-foreground">
                  System prompts have higher priority and are harder to override via jailbreaks.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="model">Recommended Model (optional)</Label>
                <Input
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g., gpt-4, claude-3-sonnet"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="commitMessage" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Commit Message
                </Label>
                <Input
                  id="commitMessage"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Initial version"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="autoApprove"
                  checked={autoApprove}
                  onChange={(e) => setAutoApprove(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="autoApprove" className="text-sm font-normal cursor-pointer">
                  Auto-approve initial version (recommended for new prompts)
                </Label>
              </div>
            </CardContent>
          </Card>

          <div className="bg-muted/50 rounded-lg p-4 border">
            <h3 className="text-sm font-medium mb-2">Governance Note</h3>
            <p className="text-sm text-muted-foreground">
              Prompts are versioned like source code. Future changes will require approval 
              (4-eyes principle) unless auto-approved. All versions are tracked in the audit log.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
