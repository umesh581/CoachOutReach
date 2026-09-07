'use client';

import { useState } from 'react';

interface InitialSettings {
  sender_name: string;
  sender_company: string;
  sender_email: string;
  mailing_address: string;
  daily_send_limit: number;
  firecrawl_api_key_masked: string;
  anthropic_api_key_masked: string;
  resend_api_key_masked: string;
}

export default function SettingsClient({ initial }: { initial: InitialSettings }) {
  const [form, setForm] = useState({
    sender_name: initial.sender_name,
    sender_company: initial.sender_company,
    sender_email: initial.sender_email,
    mailing_address: initial.mailing_address,
    daily_send_limit: initial.daily_send_limit,
    firecrawl_api_key: '',
    anthropic_api_key: '',
    resend_api_key: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setSaved(true);
      setForm((f) => ({ ...f, firecrawl_api_key: '', anthropic_api_key: '', resend_api_key: '' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sender identity, compliance details, and provider API keys. Keys are stored server-side and are
          never sent to the browser.
        </p>
      </div>

      <form onSubmit={save} className="space-y-6">
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        {saved && <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">Settings saved.</p>}

        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Sender identity &amp; compliance
          </h2>
          <p className="text-xs text-slate-500">
            Required by CAN-SPAM (and expected in the UK/AU): every email includes your real name,
            company, and a physical mailing address, plus a one-click unsubscribe link.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Sender name"
              value={form.sender_name}
              onChange={(v) => setForm((f) => ({ ...f, sender_name: v }))}
              required
            />
            <TextField
              label="Company"
              value={form.sender_company}
              onChange={(v) => setForm((f) => ({ ...f, sender_company: v }))}
            />
            <TextField
              label="Sender email (must be verified in Resend)"
              type="email"
              value={form.sender_email}
              onChange={(v) => setForm((f) => ({ ...f, sender_email: v }))}
              required
            />
            <TextField
              label="Daily send limit"
              type="number"
              value={String(form.daily_send_limit)}
              onChange={(v) => setForm((f) => ({ ...f, daily_send_limit: Number(v) || 40 }))}
            />
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-slate-700">Physical mailing address</label>
              <textarea
                required
                value={form.mailing_address}
                onChange={(e) => setForm((f) => ({ ...f, mailing_address: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="123 Main St, Suite 100, Austin, TX 78701"
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">API keys</h2>
          <KeyField
            label="Firecrawl API key"
            masked={initial.firecrawl_api_key_masked}
            value={form.firecrawl_api_key}
            onChange={(v) => setForm((f) => ({ ...f, firecrawl_api_key: v }))}
          />
          <KeyField
            label="Anthropic API key"
            masked={initial.anthropic_api_key_masked}
            value={form.anthropic_api_key}
            onChange={(v) => setForm((f) => ({ ...f, anthropic_api_key: v }))}
          />
          <KeyField
            label="Resend API key"
            masked={initial.resend_api_key_masked}
            value={form.resend_api_key}
            onChange={(v) => setForm((f) => ({ ...f, resend_api_key: v }))}
          />
          <p className="text-xs text-slate-400">
            Leave a key field blank to keep the currently configured key. Keys can also be supplied via
            environment variables as a fallback for local development.
          </p>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </form>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = 'text',
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </label>
  );
}

function KeyField({
  label,
  masked,
  value,
  onChange,
}: {
  label: string;
  masked: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={masked ? `Configured: ${masked}` : 'Not configured'}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-mono"
      />
    </label>
  );
}
