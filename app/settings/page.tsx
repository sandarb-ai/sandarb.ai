'use client';

import { useState, useEffect, useCallback } from 'react';
import { Save, Copy, Eye, EyeOff, RefreshCw, Sun, Moon, CheckCircle2, XCircle, Loader2, ExternalLink, Palette, Settings2, Database, Sparkles, Key, Info } from 'lucide-react';
import { useTheme } from 'next-themes';
import { apiUrl, getWriteAuthHeaders } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type ThemeValue = 'light' | 'dark';

interface ConfigField {
  value: string;
  is_secret: boolean;
  description: string;
}

type SectionConfig = Record<string, ConfigField | { updated_at: string | null; updated_by: string | null; has_row: boolean }>;

interface TestResult {
  success: boolean;
  data: Record<string, any>;
}

const NAV_ITEMS = [
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'general', label: 'General', icon: Settings2 },
  { id: 'data-platform', label: 'Data Platform', icon: Database },
  { id: 'gen-ai', label: 'Gen AI', icon: Sparkles },
  { id: 'api', label: 'API', icon: Key },
  { id: 'about', label: 'About', icon: Info },
] as const;

type SectionId = (typeof NAV_ITEMS)[number]['id'];

export default function SettingsPage() {
  const { theme, setTheme: setThemeLocal } = useTheme();
  const [activeSection, setActiveSection] = useState<SectionId>('appearance');
  const [apiKey, setApiKey] = useState('sk-sandarb-xxxxxxxxxxxx');
  const [showApiKey, setShowApiKey] = useState(false);
  const [defaultFormat, setDefaultFormat] = useState('json');
  const [appearance, setAppearance] = useState<ThemeValue>('light');
  const [savingTheme, setSavingTheme] = useState(false);

  // Platform config state
  const [platformConfig, setPlatformConfig] = useState<Record<string, SectionConfig>>({});
  const [dpEdits, setDpEdits] = useState<Record<string, string>>({});
  const [aiEdits, setAiEdits] = useState<Record<string, string>>({});
  const [savingDP, setSavingDP] = useState(false);
  const [savingAI, setSavingAI] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [testingSection, setTestingSection] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  // Fetch platform config
  const fetchPlatformConfig = useCallback(() => {
    fetch(apiUrl('/api/platform-config'))
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setPlatformConfig(d.data);
          const dpInit: Record<string, string> = {};
          const aiInit: Record<string, string> = {};
          for (const section of ['kafka', 'clickhouse', 'superset']) {
            const cfg = d.data[section];
            if (cfg) {
              for (const [key, field] of Object.entries(cfg)) {
                if (key === '_meta') continue;
                dpInit[`${section}.${key}`] = (field as ConfigField).value;
              }
            }
          }
          const genAi = d.data.gen_ai;
          if (genAi) {
            for (const [key, field] of Object.entries(genAi)) {
              if (key === '_meta') continue;
              aiInit[key] = (field as ConfigField).value;
            }
          }
          setDpEdits(dpInit);
          setAiEdits(aiInit);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Read current theme from next-themes (which reads localStorage) to set the button highlight.
    // Do NOT fetch from backend DB here — ThemeSync handles the one-time seed.
    // This avoids the bug where DB has "dark" and visiting settings forces dark mode.
    if (theme && (theme === 'light' || theme === 'dark')) {
      setAppearance(theme as ThemeValue);
    }
    fetchPlatformConfig();
  }, [theme, fetchPlatformConfig]);

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

  const saveDataPlatform = async () => {
    setSavingDP(true);
    try {
      for (const section of ['kafka', 'clickhouse', 'superset'] as const) {
        const updates: Record<string, string> = {};
        for (const [compoundKey, value] of Object.entries(dpEdits)) {
          if (compoundKey.startsWith(`${section}.`)) {
            const key = compoundKey.replace(`${section}.`, '');
            updates[key] = value;
          }
        }
        if (Object.keys(updates).length > 0) {
          await fetch(apiUrl(`/api/platform-config/${section}`), {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', ...getWriteAuthHeaders() },
            body: JSON.stringify(updates),
          });
        }
      }
      fetchPlatformConfig();
    } finally {
      setSavingDP(false);
    }
  };

  const saveGenAI = async () => {
    setSavingAI(true);
    try {
      await fetch(apiUrl('/api/platform-config/gen_ai'), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...getWriteAuthHeaders() },
        body: JSON.stringify(aiEdits),
      });
      fetchPlatformConfig();
    } finally {
      setSavingAI(false);
    }
  };

  const testConnection = async (section: string) => {
    setTestingSection(section);
    setTestResults((prev) => ({ ...prev, [section]: undefined as any }));
    try {
      const resp = await fetch(apiUrl(`/api/platform-config/${section}/test`), { method: 'POST' });
      const data = await resp.json();
      setTestResults((prev) => ({ ...prev, [section]: data }));
    } catch {
      setTestResults((prev) => ({ ...prev, [section]: { success: false, data: { status: 'error', message: 'Network error' } } }));
    } finally {
      setTestingSection(null);
    }
  };

  const dpVal = (section: string, key: string) => dpEdits[`${section}.${key}`] ?? '';
  const setDpVal = (section: string, key: string, value: string) =>
    setDpEdits((prev) => ({ ...prev, [`${section}.${key}`]: value }));

  const aiVal = (key: string) => aiEdits[key] ?? '';
  const setAiVal = (key: string, value: string) =>
    setAiEdits((prev) => ({ ...prev, [key]: value }));

  const toggleSecret = (key: string) =>
    setShowSecrets((prev) => ({ ...prev, [key]: !prev[key] }));

  const TestBadge = ({ section }: { section: string }) => {
    const result = testResults[section];
    if (!result) return null;
    const status = result.data?.status;
    if (status === 'connected' || status === 'configured') {
      return <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800 ml-2"><CheckCircle2 className="h-3 w-3 mr-1" />{status}</Badge>;
    }
    if (status === 'disabled') {
      return <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-800 ml-2">{status}</Badge>;
    }
    return <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 ml-2"><XCircle className="h-3 w-3 mr-1" />{result.data?.message || 'error'}</Badge>;
  };

  const SecretInput = ({ value, onChange, secretKey, placeholder }: { value: string; onChange: (v: string) => void; secretKey: string; placeholder?: string }) => (
    <div className="relative">
      <Input
        type={showSecrets[secretKey] ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pr-10 font-mono"
      />
      <Button
        variant="ghost"
        size="icon"
        type="button"
        className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
        onClick={() => toggleSecret(secretKey)}
      >
        {showSecrets[secretKey] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </Button>
    </div>
  );

  return (
    <div className="flex h-full">
      {/* Left Nav */}
      <nav className="w-[200px] shrink-0 border-r border-border/60 bg-muted/30 py-4 px-2 overflow-y-auto">
        <div className="mb-3 px-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Settings</h2>
        </div>
        <div className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={cn(
                  'group relative flex w-full items-center gap-3 rounded-md px-2 py-2 text-[14px] font-medium transition-colors text-left',
                  'hover:bg-violet-100/80 dark:hover:bg-violet-900/20',
                  active
                    ? 'bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-7 w-0.5 rounded-full bg-violet-500 dark:bg-violet-400" />
                )}
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
                    active
                      ? 'bg-violet-200/80 text-violet-700 shadow-sm dark:bg-violet-800/50 dark:text-violet-200'
                      : 'text-muted-foreground group-hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Right Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="flex items-center justify-between border-b bg-background px-6 py-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {NAV_ITEMS.find((i) => i.id === activeSection)?.label}
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure Sandarb AI Governance
            </p>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-3xl space-y-6">

            {/* ── Appearance ──────────────────────────────── */}
            {activeSection === 'appearance' && (
              <Card>
                <CardHeader>
                  <CardTitle>Theme</CardTitle>
                  <CardDescription>
                    Choose light or dark appearance.
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
                </CardContent>
              </Card>
            )}

            {/* ── General ─────────────────────────────────── */}
            {activeSection === 'general' && (
              <>
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
              </>
            )}

            {/* ── Data Platform ────────────────────────────── */}
            {activeSection === 'data-platform' && (
              <>
                {/* Kafka */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">Kafka Cluster <TestBadge section="kafka" /></CardTitle>
                        <CardDescription>Event streaming for governance analytics pipeline</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            checked={dpVal('kafka', 'enabled') !== 'false'}
                            onChange={(e) => setDpVal('kafka', 'enabled', e.target.checked ? 'true' : 'false')}
                            className="rounded"
                          />
                          Enabled
                        </label>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Bootstrap Servers</Label>
                      <Input
                        value={dpVal('kafka', 'bootstrap_servers')}
                        onChange={(e) => setDpVal('kafka', 'bootstrap_servers', e.target.value)}
                        placeholder="localhost:9092,localhost:9093"
                        className="font-mono"
                      />
                      <p className="text-xs text-muted-foreground">Comma-separated Kafka broker addresses</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Compression</Label>
                        <select
                          value={dpVal('kafka', 'compression_type')}
                          onChange={(e) => setDpVal('kafka', 'compression_type', e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="lz4">LZ4</option>
                          <option value="snappy">Snappy</option>
                          <option value="gzip">Gzip</option>
                          <option value="zstd">Zstd</option>
                          <option value="none">None</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Acks</Label>
                        <select
                          value={dpVal('kafka', 'acks')}
                          onChange={(e) => setDpVal('kafka', 'acks', e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="0">0 (No ack)</option>
                          <option value="1">1 (Leader ack)</option>
                          <option value="all">All (Full ISR)</option>
                        </select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* ClickHouse */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">ClickHouse Cluster <TestBadge section="clickhouse" /></CardTitle>
                    <CardDescription>Analytics database for governance events</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>HTTP Endpoint URL</Label>
                      <Input
                        value={dpVal('clickhouse', 'url')}
                        onChange={(e) => setDpVal('clickhouse', 'url', e.target.value)}
                        placeholder="http://localhost:8123"
                        className="font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Database</Label>
                        <Input
                          value={dpVal('clickhouse', 'database_name')}
                          onChange={(e) => setDpVal('clickhouse', 'database_name', e.target.value)}
                          placeholder="sandarb"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Username</Label>
                        <Input
                          value={dpVal('clickhouse', 'username')}
                          onChange={(e) => setDpVal('clickhouse', 'username', e.target.value)}
                          placeholder="default"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <SecretInput
                          value={dpVal('clickhouse', 'password')}
                          onChange={(v) => setDpVal('clickhouse', 'password', v)}
                          secretKey="ch_password"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Superset */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">Apache Superset <TestBadge section="superset" /></CardTitle>
                    <CardDescription>Business intelligence dashboards for governance analytics</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label>Superset URL</Label>
                      <div className="flex gap-2">
                        <Input
                          value={dpVal('superset', 'url')}
                          onChange={(e) => setDpVal('superset', 'url', e.target.value)}
                          placeholder="http://localhost:8088"
                          className="font-mono flex-1"
                        />
                        {dpVal('superset', 'url') && (
                          <Button variant="outline" asChild>
                            <a href={dpVal('superset', 'url')} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-1" /> Open
                            </a>
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Username</Label>
                        <Input
                          value={dpVal('superset', 'username')}
                          onChange={(e) => setDpVal('superset', 'username', e.target.value)}
                          placeholder="admin"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Password</Label>
                        <SecretInput
                          value={dpVal('superset', 'password')}
                          onChange={(v) => setDpVal('superset', 'password', v)}
                          secretKey="superset_password"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button onClick={saveDataPlatform} disabled={savingDP}>
                    {savingDP ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Data Platform Settings
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      for (const s of ['kafka', 'clickhouse', 'superset']) {
                        await testConnection(s);
                      }
                    }}
                    disabled={testingSection !== null}
                  >
                    {testingSection ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Test Connections
                  </Button>
                </div>
              </>
            )}

            {/* ── Gen AI ──────────────────────────────────── */}
            {activeSection === 'gen-ai' && (
              <>
                {/* LLM Provider */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">LLM Provider <TestBadge section="gen_ai" /></CardTitle>
                    <CardDescription>Language model for natural language to Jinja2 template generation</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Provider</Label>
                        <select
                          value={aiVal('provider')}
                          onChange={(e) => setAiVal('provider', e.target.value)}
                          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="anthropic">Anthropic</option>
                          <option value="openai">OpenAI</option>
                          <option value="azure">Azure OpenAI</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label>Model</Label>
                        <Input
                          value={aiVal('model')}
                          onChange={(e) => setAiVal('model', e.target.value)}
                          placeholder="claude-sonnet-4-5-20250929"
                          className="font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>API Key</Label>
                      <SecretInput
                        value={aiVal('api_key')}
                        onChange={(v) => setAiVal('api_key', v)}
                        secretKey="ai_api_key"
                        placeholder="sk-..."
                      />
                      <p className="text-xs text-muted-foreground">Your LLM provider API key (stored encrypted)</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Base URL (optional)</Label>
                      <Input
                        value={aiVal('base_url')}
                        onChange={(e) => setAiVal('base_url', e.target.value)}
                        placeholder="Custom endpoint for Azure or self-hosted models"
                        className="font-mono"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Model Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle>Model Configuration</CardTitle>
                    <CardDescription>Tune generation parameters</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Temperature ({aiVal('temperature') || '0.3'})</Label>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={aiVal('temperature') || '0.3'}
                          onChange={(e) => setAiVal('temperature', e.target.value)}
                          className="w-full accent-violet-600"
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Precise (0)</span>
                          <span>Creative (1)</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Max Tokens</Label>
                        <Input
                          type="number"
                          value={aiVal('max_tokens') || '4096'}
                          onChange={(e) => setAiVal('max_tokens', e.target.value)}
                          min={256}
                          max={200000}
                        />
                        <p className="text-xs text-muted-foreground">Maximum output tokens for generation</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* System Prompt */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>System Prompt</CardTitle>
                        <CardDescription>Instructions for natural language to Jinja2 template generation</CardDescription>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(aiVal('system_prompt') || '').length.toLocaleString()} chars
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      value={aiVal('system_prompt')}
                      onChange={(e) => setAiVal('system_prompt', e.target.value)}
                      placeholder="Enter your system prompt for context generation..."
                      className="min-h-[400px] font-mono text-sm resize-y"
                    />
                    <p className="text-xs text-muted-foreground">
                      This prompt instructs the LLM how to convert natural language descriptions into Jinja2 context templates.
                      Include examples, formatting rules, and any domain-specific constraints.
                    </p>
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button onClick={saveGenAI} disabled={savingAI}>
                    {savingAI ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Gen AI Settings
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => testConnection('gen_ai')}
                    disabled={testingSection !== null}
                  >
                    {testingSection === 'gen_ai' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                    Test Configuration
                  </Button>
                </div>
              </>
            )}

            {/* ── API ─────────────────────────────────────── */}
            {activeSection === 'api' && (
              <>
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
              </>
            )}

            {/* ── About ───────────────────────────────────── */}
            {activeSection === 'about' && (
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
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
