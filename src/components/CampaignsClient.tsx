'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Campaign, CampaignStatus, Country } from '@/lib/types';
import { cn } from '@/lib/utils';

interface EnrichedCampaign extends Campaign {
  prospectCount: number;
  stageBreakdown: Record<string, number>;
}

export default function CampaignsClient({ initialCampaigns }: { initialCampaigns: EnrichedCampaign[] }) {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState<{ name: string; niche: string; target_country: Country | ''; status: CampaignStatus }>({
    name: '',
    niche: '',
    target_country: '',
    status: 'active',
  });

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          niche: form.niche || null,
          target_country: form.target_country || null,
          status: form.status,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setCampaigns((prev) => [{ ...json.campaign, prospectCount: 0, stageBreakdown: {} }, ...prev]);
      setForm({ name: '', niche: '', target_country: '', status: 'active' });
      setShowForm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create campaign');
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: CampaignStatus) {
    setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)));
    await fetch(`/api/campaigns/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function deleteCampaign(id: string) {
    if (!confirm('Delete this campaign? Prospects will be kept but unassigned.')) return;
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/campaigns/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Campaigns</h1>
          <p className="mt-1 text-sm text-slate-500">Group prospects by niche and target country.</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          {showForm ? 'Cancel' : 'New campaign'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={createCampaign} className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">Name</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. US Business Coaches Q1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Niche</label>
              <input
                value={form.niche}
                onChange={(e) => setForm((f) => ({ ...f, niche: e.target.value }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                placeholder="e.g. business coaches with a group program"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Target country</label>
              <select
                value={form.target_country}
                onChange={(e) => setForm((f) => ({ ...f, target_country: e.target.value as Country }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Select…</option>
                <option value="US">United States</option>
                <option value="UK">United Kingdom</option>
                <option value="AU">Australia</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as CampaignStatus }))}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create campaign'}
          </button>
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.map((c) => (
          <div key={c.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">{c.name}</h3>
                <p className="text-xs text-slate-500">
                  {c.niche || 'No niche set'} · {c.target_country || '—'}
                </p>
              </div>
              <select
                value={c.status}
                onChange={(e) => updateStatus(c.id, e.target.value as CampaignStatus)}
                className={cn(
                  'rounded-full border-0 px-2 py-0.5 text-xs font-medium',
                  c.status === 'active'
                    ? 'bg-emerald-50 text-emerald-700'
                    : c.status === 'paused'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-slate-100 text-slate-500',
                )}
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="archived">Archived</option>
              </select>
            </div>

            <p className="mt-4 text-sm text-slate-600">{c.prospectCount} prospects</p>
            {Object.keys(c.stageBreakdown).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.entries(c.stageBreakdown).map(([stage, count]) => (
                  <span key={stage} className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                    {stage}: {count}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <Link
                href={`/prospects?campaign_id=${c.id}`}
                className="text-sm font-medium text-slate-700 hover:underline"
              >
                View prospects →
              </Link>
              <button onClick={() => deleteCampaign(c.id)} className="text-xs text-red-600 hover:underline">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {campaigns.length === 0 && !showForm && (
        <p className="text-sm text-slate-500">No campaigns yet. Create one to start organizing prospects.</p>
      )}
    </div>
  );
}
