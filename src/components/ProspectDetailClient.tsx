'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Activity, Country, FunnelAnalysis, Message, Prospect, ProspectStage } from '@/lib/types';
import { PROSPECT_STAGES, STAGE_LABELS } from '@/lib/types';
import { cn, formatDateTime } from '@/lib/utils';

interface Props {
  prospect: Prospect;
  campaigns: { id: string; name: string }[];
  initialAnalyses: FunnelAnalysis[];
  initialMessages: Message[];
  initialActivities: Activity[];
}

export default function ProspectDetailClient({
  prospect: initialProspect,
  campaigns,
  initialAnalyses,
  initialMessages,
  initialActivities,
}: Props) {
  const router = useRouter();
  const [prospect, setProspect] = useState(initialProspect);
  const [analyses, setAnalyses] = useState(initialAnalyses);
  const [messages, setMessages] = useState(initialMessages);
  const [activities, setActivities] = useState(initialActivities);
  const [globalError, setGlobalError] = useState('');

  function addActivity(a: Activity) {
    setActivities((prev) => [a, ...prev]);
  }

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/prospects" className="text-sm text-slate-500 hover:underline">
        ← Back to prospects
      </Link>

      {globalError && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{globalError}</p>
      )}

      <ContactCard
        prospect={prospect}
        campaigns={campaigns}
        onUpdated={(p) => {
          setProspect(p);
          router.refresh();
        }}
        onError={setGlobalError}
      />

      <FunnelAnalysisSection
        prospect={prospect}
        analyses={analyses}
        onAnalyzed={(analysis, updatedProspect) => {
          setAnalyses((prev) => [analysis, ...prev]);
          if (updatedProspect) setProspect(updatedProspect);
          addActivity({
            id: `local-${Date.now()}`,
            prospect_id: prospect.id,
            type: 'note',
            note: `Funnel analysis completed for ${analysis.source_url}`,
            created_at: new Date().toISOString(),
          });
          router.refresh();
        }}
        onError={setGlobalError}
      />

      <MessagesSection
        prospect={prospect}
        messages={messages}
        hasFindings={analyses.length > 0}
        onGenerated={(message) => {
          setMessages((prev) => [message, ...prev]);
          router.refresh();
        }}
        onUpdated={(message) => {
          setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
        }}
        onSent={(message) => {
          setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
          setProspect((p) => ({ ...p, stage: 'messaged' }));
          addActivity({
            id: `local-${Date.now()}`,
            prospect_id: prospect.id,
            type: 'email_sent',
            note: `Sent: "${message.subject}"`,
            created_at: new Date().toISOString(),
          });
          router.refresh();
        }}
        onError={setGlobalError}
      />

      <ActivityTimeline activities={activities} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Contact card
// ---------------------------------------------------------------------------

function ContactCard({
  prospect,
  campaigns,
  onUpdated,
  onError,
}: {
  prospect: Prospect;
  campaigns: { id: string; name: string }[];
  onUpdated: (p: Prospect) => void;
  onError: (msg: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: prospect.name,
    company: prospect.company || '',
    email: prospect.email || '',
    website_url: prospect.website_url || '',
    linkedin_url: prospect.linkedin_url || '',
    country: prospect.country || '',
    campaign_id: prospect.campaign_id || '',
  });

  async function save() {
    setSaving(true);
    onError('');
    try {
      const res = await fetch(`/api/prospects/${prospect.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, country: form.country || null, campaign_id: form.campaign_id || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onUpdated(json.prospect);
      setEditing(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function changeStage(stage: ProspectStage) {
    onError('');
    const res = await fetch(`/api/prospects/${prospect.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    });
    const json = await res.json();
    if (!res.ok) {
      onError(json.error);
      return;
    }
    onUpdated(json.prospect);
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{prospect.name}</h1>
          <p className="text-sm text-slate-500">{prospect.company || 'No company set'}</p>
        </div>
        <div className="flex items-center gap-2">
          {prospect.stage === 'unsubscribed' && (
            <span className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
              Unsubscribed — sends blocked
            </span>
          )}
          <select
            value={prospect.stage}
            onChange={(e) => changeStage(e.target.value as ProspectStage)}
            className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          >
            {PROSPECT_STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_LABELS[s]}
              </option>
            ))}
          </select>
          <button
            onClick={() => setEditing((v) => !v)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>
      </div>

      {editing ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Name">
            <input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Company">
            <input
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Country">
            <select
              value={form.country}
              onChange={(e) => setForm((f) => ({ ...f, country: e.target.value as Country }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">—</option>
              <option value="US">United States</option>
              <option value="UK">United Kingdom</option>
              <option value="AU">Australia</option>
            </select>
          </Field>
          <Field label="Website URL">
            <input
              value={form.website_url}
              onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="LinkedIn URL">
            <input
              value={form.linkedin_url}
              onChange={(e) => setForm((f) => ({ ...f, linkedin_url: e.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Campaign">
            <select
              value={form.campaign_id}
              onChange={(e) => setForm((f) => ({ ...f, campaign_id: e.target.value }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">No campaign</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      ) : (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <Info label="Email" value={prospect.email} />
          <Info label="Country" value={prospect.country} />
          <Info
            label="Website"
            value={prospect.website_url}
            href={prospect.website_url ? ensureUrl(prospect.website_url) : undefined}
          />
          <Info
            label="LinkedIn"
            value={prospect.linkedin_url}
            href={prospect.linkedin_url ? ensureUrl(prospect.linkedin_url) : undefined}
          />
          <Info label="Source" value={prospect.source} />
          <Info label="Intent score" value={String(prospect.intent_score)} />
        </dl>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Info({ label, value, href }: { label: string; value: string | null; href?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400">{label}</dt>
      <dd className="text-slate-800">
        {value ? (
          href ? (
            <a href={href} target="_blank" rel="noreferrer" className="text-slate-700 hover:underline">
              {value}
            </a>
          ) : (
            value
          )
        ) : (
          '—'
        )}
      </dd>
    </div>
  );
}

function ensureUrl(url: string) {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

// ---------------------------------------------------------------------------
// Funnel analysis section
// ---------------------------------------------------------------------------

function FunnelAnalysisSection({
  prospect,
  analyses,
  onAnalyzed,
  onError,
}: {
  prospect: Prospect;
  analyses: FunnelAnalysis[];
  onAnalyzed: (analysis: FunnelAnalysis, updatedProspect?: Prospect) => void;
  onError: (msg: string) => void;
}) {
  const [loading, setLoading] = useState(false);

  async function analyze() {
    setLoading(true);
    onError('');
    try {
      const res = await fetch(`/api/prospects/${prospect.id}/analyze`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onAnalyzed(json.analysis, { ...prospect, stage: 'analyzed' });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Funnel analysis</h2>
        <button
          onClick={analyze}
          disabled={loading || !prospect.website_url}
          title={!prospect.website_url ? 'Add a website URL first' : undefined}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? 'Analyzing…' : 'Analyze funnel'}
        </button>
      </div>

      {analyses.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No analysis yet. Run one to scrape their site with Firecrawl and generate an internal findings
          brief with Claude.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {analyses.map((a) => (
            <div key={a.id} className="rounded-md border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <a href={a.source_url} target="_blank" rel="noreferrer" className="hover:underline">
                  {a.source_url}
                </a>
                <span>{formatDateTime(a.analyzed_at)}</span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{a.findings_brief}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Messages section
// ---------------------------------------------------------------------------

function MessagesSection({
  prospect,
  messages,
  hasFindings,
  onGenerated,
  onUpdated,
  onSent,
  onError,
}: {
  prospect: Prospect;
  messages: Message[];
  hasFindings: boolean;
  onGenerated: (m: Message) => void;
  onUpdated: (m: Message) => void;
  onSent: (m: Message) => void;
  onError: (msg: string) => void;
}) {
  const [generating, setGenerating] = useState(false);

  async function generate() {
    setGenerating(true);
    onError('');
    try {
      const res = await fetch(`/api/prospects/${prospect.id}/generate-message`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onGenerated(json.message);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Message generation failed');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Outreach messages</h2>
        <button
          onClick={generate}
          disabled={generating || !hasFindings || prospect.stage === 'unsubscribed'}
          title={!hasFindings ? 'Run "Analyze funnel" first' : undefined}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {generating ? 'Generating…' : 'Generate message'}
        </button>
      </div>

      {messages.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">
          No messages yet. Generate a draft after analyzing their funnel.
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {messages.map((m) => (
            <MessageCard
              key={m.id}
              message={m}
              prospect={prospect}
              onUpdated={onUpdated}
              onSent={onSent}
              onError={onError}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  approved: 'bg-blue-50 text-blue-700',
  sent: 'bg-slate-800 text-white',
  opened: 'bg-emerald-50 text-emerald-700',
  replied: 'bg-purple-50 text-purple-700',
  bounced: 'bg-red-50 text-red-700',
};

function MessageCard({
  message,
  prospect,
  onUpdated,
  onSent,
  onError,
}: {
  message: Message;
  prospect: Prospect;
  onUpdated: (m: Message) => void;
  onSent: (m: Message) => void;
  onError: (msg: string) => void;
}) {
  const [subject, setSubject] = useState(message.subject || '');
  const [body, setBody] = useState(message.body);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const isDraft = message.status === 'draft' || message.status === 'approved';
  const dirty = subject !== (message.subject || '') || body !== message.body;

  async function saveDraft() {
    setSaving(true);
    onError('');
    try {
      const res = await fetch(`/api/messages/${message.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onUpdated(json.message);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  }

  async function send() {
    if (dirty) {
      await saveDraft();
    }
    if (!confirm(`Send this email to ${prospect.email}?`)) return;
    setSending(true);
    onError('');
    try {
      const res = await fetch(`/api/messages/${message.id}/send`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onSent(json.message);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <span
          className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLES[message.status])}
        >
          {message.status}
        </span>
        <span className="text-xs text-slate-400">
          {message.sent_at ? `Sent ${formatDateTime(message.sent_at)}` : `Drafted ${formatDateTime(message.created_at)}`}
        </span>
      </div>

      {isDraft ? (
        <div className="mt-3 space-y-2">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium"
            placeholder="Subject"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={saveDraft}
              disabled={saving || !dirty}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save draft'}
            </button>
            <button
              onClick={send}
              disabled={sending || !prospect.email || prospect.stage === 'unsubscribed'}
              title={!prospect.email ? 'Prospect has no email on file' : undefined}
              className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {sending ? 'Sending…' : `Send to ${prospect.email || '—'}`}
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Review and edit before sending — nothing goes out without this step.
          </p>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm font-medium text-slate-800">{message.subject}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{message.body}</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity timeline
// ---------------------------------------------------------------------------

function ActivityTimeline({ activities }: { activities: Activity[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Activity</h2>
      {activities.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No activity recorded yet.</p>
      ) : (
        <ul className="mt-4 space-y-3 border-l border-slate-200 pl-4">
          {activities.map((a) => (
            <li key={a.id} className="relative text-sm">
              <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-slate-300" />
              <p className="text-slate-800">{a.note || a.type}</p>
              <p className="text-xs text-slate-400">{formatDateTime(a.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
