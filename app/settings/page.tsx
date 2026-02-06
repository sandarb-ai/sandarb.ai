'use client';

import { useState, useEffect } from 'react';
import { Save, Copy, Eye, EyeOff, RefreshCw, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { apiUrl, getWriteAuthHeaders } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type ThemeValue = 'light' | 'dark' | 'system';

export default function SettingsPage() {
  const { theme, setTheme: setThemeLocal } = useTheme();
  const [apiKey, setApiKey] = useState('sk-sandarb-xxxxxxxxxxxx');
  const [showApiKey, setShowApiKey] = useState(false);
  const [defaultFormat, setDefaultFormat] = useState('json');
  const [appearance, setAppearance] = useState<ThemeValue>('light');
  const [savingTheme, setSavingTheme] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/settings'))
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data.theme) {
          const t = d.data.theme as ThemeValue;
          setAppearance(t);
          setThemeLocal(t);
        }
      })
      .catch(() => {});
  }, [setThemeLocal]);

  const handleAppearanceChange = (value: ThemeValue) => {
    setAppearance(value);
    setSavingTheme(true);
    setThemeLocal(value);
fetch(apiUrl('/api/settings'), {
        method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getWriteAuthHeaders() },
      body: JSON.stringify({ theme: value }),
    })
      .then(() => {})
      .finally(() => setSavingTheme(false));
  };

  const generateNewApiKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const key = 'sk-sandarb-' + Array(24)
      .fill(0)
      .map(() => chars[Math.floor(Math.random() * chars.length)])
      .join('');
    setApiKey(key);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure Sandarb AI Governance
          </p>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-2xl space-y-6">
          <Tabs defaultValue="appearance">
            <TabsList>
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="api">API</TabsTrigger>
              <TabsTrigger value="about">About</TabsTrigger>
            </TabsList>

            <TabsContent value="appearance" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Theme</CardTitle>
                  <CardDescription>
                    Choose light, dark, or follow your system preference.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button
                    variant={appearance === 'light' ? 'default' : 'outline'}
                    onClick={() => handleAppearanceChange('light')}
                    disabled={savingTheme}
                  >
                    <Sun className="h-4 w-4 mr-2" />
                    Light
                  </Button>
                  <Button
                    variant={appearance === 'dark' ? 'default' : 'outline'}
                    onClick={() => handleAppearanceChange('dark')}
                    disabled={savingTheme}
                  >
                    <Moon className="h-4 w-4 mr-2" />
                    Dark
                  </Button>
                  <Button
                    variant={appearance === 'system' ? 'default' : 'outline'}
                    onClick={() => handleAppearanceChange('system')}
                    disabled={savingTheme}
                  >
                    <Monitor className="h-4 w-4 mr-2" />
                    System
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="general" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Default Format</CardTitle>
                  <CardDescription>
                    Default output format for context injection
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-4">
                    {['json', 'yaml', 'text'].map((format) => (
                      <Button
                        key={format}
                        variant={defaultFormat === format ? 'default' : 'outline'}
                        onClick={() => setDefaultFormat(format)}
                        className="uppercase"
                      >
                        {format}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Database</CardTitle>
                  <CardDescription>PostgreSQL connection</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Database</Label>
                    <Input value="PostgreSQL (DATABASE_URL)" disabled />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline">Export Data</Button>
                    <Button variant="outline">Import Data</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="api" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>API Key</CardTitle>
                  <CardDescription>
                    Use this key to authenticate API requests
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          type={showApiKey ? 'text' : 'password'}
                          value={apiKey}
                          readOnly
                          className="pr-10 font-mono"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                          onClick={() => setShowApiKey(!showApiKey)}
                        >
                          {showApiKey ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => navigator.clipboard.writeText(apiKey)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" onClick={generateNewApiKey}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted p-4 space-y-2">
                    <p className="text-sm font-medium">Usage Example</p>
                    <pre className="text-xs font-mono text-muted-foreground overflow-auto">
                      {`curl -H "Authorization: Bearer ${apiKey}" \\
  "http://localhost:4000/api/inject?name=my-context"`}
                    </pre>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Endpoints</CardTitle>
                  <CardDescription>Available API endpoints</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 font-mono text-sm">
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-green-600">GET</span>
                      <span>/api/contexts</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-blue-600">POST</span>
                      <span>/api/contexts</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-green-600">GET</span>
                      <span>/api/contexts/:id</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-yellow-600">PUT</span>
                      <span>/api/contexts/:id</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-red-600">DELETE</span>
                      <span>/api/contexts/:id</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-green-600">GET</span>
                      <span>/api/inject</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="about" className="space-y-6 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Sandarb</CardTitle>
                  <CardDescription>
                    The Sandarb AI Governance Agent: regulatory, controls, risk management, and compliance for AI agents. Participates in A2A (industry standard for agent-to-agent communication). Sandarb runs as UI, API, and A2A participant so other agents talk to it for validation, audit, and approved context; Sandarb can also communicate with other agents via A2A.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Version</span>
                      <span>0.2.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">License</span>
                      <span>Apache-2.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Repository</span>
                      <a
                        href="https://github.com/sandarb-ai/sandarb.ai"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        GitHub
                      </a>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground">
                    The Sandarb AI Governance Agent is the governance layer for AI agents: approval workflows, audit logging,
                    and A2A (industry standard for agent-to-agent communication) so other agents call Sandarb for validation and compliance, and Sandarb can communicate with other agents via A2A. Built with Next.js,
                    TypeScript, and PostgreSQL. All UI actions are exposed via API.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
