'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { PROSPECT_STAGES, STAGE_LABELS, type Prospect, type ProspectStage } from '@/lib/types';
import { cn } from '@/lib/utils';

interface CampaignOption {
  id: string;
  name: string;
}

export default function ProspectsBoard({
  initialProspects,
  campaigns,
  initialCampaignFilter,
}: {
  initialProspects: Prospect[];
  campaigns: CampaignOption[];
  initialCampaignFilter: string;
}) {
  const [prospects, setProspects] = useState(initialProspects);
  const [campaignFilter, setCampaignFilter] = useState(initialCampaignFilter);
  const [showAddForm, setShowAddForm] = useState(false);

  const visible = useMemo(
    () => (campaignFilter ? prospects.filter((p) => p.campaign_id === campaignFilter) : prospects),
    [prospects, campaignFilter],
  );

  const columns = useMemo(() => {
    const map = Object.fromEntries(PROSPECT_STAGES.map((s) => [s, [] as Prospect[]])) as Record<
      ProspectStage,
      Prospect[]
    >;
    for (const p of visible) {
      map[p.stage]?.push(p);
    }
    return map;
  }, [visible]);

  async function handleDragEnd(result: DropResult) {
    const { destination, draggableId, source } = result;
    if (!destination) return;
    const newStage = destination.droppableId as ProspectStage;
    if (newStage === source.droppableId) return;

    setProspects((prev) => prev.map((p) => (p.id === draggableId ? { ...p, stage: newStage } : p)));

    const res = await fetch(`/api/prospects/${draggableId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: newStage }),
    });

    if (!res.ok) {
      // Revert on failure
      setProspects((prev) =>
        prev.map((p) => (p.id === draggableId ? { ...p, stage: source.droppableId as ProspectStage } : p)),
      );
    }
  }

  function handleCreated(prospect: Prospect) {
    setProspects((prev) => [prospect, ...prev]);
    setShowAddForm(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Prospects</h1>
          <p className="mt-1 text-sm text-slate-500">Drag cards between stages to update the pipeline.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Link
            href="/prospects/import"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Import CSV
          </Link>
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            {showAddForm ? 'Cancel' : 'Add prospect'}
          </button>
        </div>
      </div>

      {showAddForm && <AddProspectForm campaigns={campaigns} onCreated={handleCreated} />}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PROSPECT_STAGES.map((stage) => (
            <Droppable droppableId={stage} key={stage}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={cn(
                    'flex w-64 shrink-0 flex-col rounded-lg border border-slate-200 bg-slate-100/60 p-2',
                    snapshot.isDraggingOver && 'bg-slate-200/60',
                  )}
                >
                  <div className="mb-2 flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold text-slate-700">{STAGE_LABELS[stage]}</h3>
                    <span className="text-xs text-slate-400">{columns[stage].length}</span>
                  </div>
                  <div className="flex-1 space-y-2">
                    {columns[stage].map((p, index) => (
                      <Draggable draggableId={p.id} index={index} key={p.id}>
                        {(dragProvided, dragSnapshot) => (
                          <Link
                            href={`/prospects/${p.id}`}
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            className={cn(
                              'block rounded-md border border-slate-200 bg-white p-3 shadow-sm hover:border-slate-300',
                              dragSnapshot.isDragging && 'ring-2 ring-slate-400',
                            )}
                          >
                            <p className="text-sm font-medium text-slate-900">{p.name}</p>
                            {p.company && <p className="text-xs text-slate-500">{p.company}</p>}
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-xs text-slate-400">{p.country || '—'}</span>
                              <span
                                className={cn(
                                  'rounded-full px-1.5 py-0.5 text-[11px] font-medium',
                                  p.intent_score >= 70
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : p.intent_score >= 40
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-slate-100 text-slate-500',
                                )}
                              >
                                {p.intent_score}
                              </span>
                            </div>
                          </Link>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}

function AddProspectForm({
  campaigns,
  onCreated,
}: {
  campaigns: CampaignOption[];
  onCreated: (p: Prospect) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    website_url: '',
    linkedin_url: '',
    country: '',
    campaign_id: '',
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, country: form.country || null, campaign_id: form.campaign_id || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      onCreated(json.prospect);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add prospect');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        <input
          required
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Company"
          value={form.company}
          onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="Website URL"
          value={form.website_url}
          onChange={(e) => setForm((f) => ({ ...f, website_url: e.target.value }))}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          placeholder="LinkedIn URL"
          value={form.linkedin_url}
          onChange={(e) => setForm((f) => ({ ...f, linkedin_url: e.target.value }))}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <select
          value={form.country}
          onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Country…</option>
          <option value="US">United States</option>
          <option value="UK">United Kingdom</option>
          <option value="AU">Australia</option>
        </select>
        <select
          value={form.campaign_id}
          onChange={(e) => setForm((f) => ({ ...f, campaign_id: e.target.value }))}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
        >
          <option value="">No campaign</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {saving ? 'Adding…' : 'Add prospect'}
      </button>
    </form>
  );
}
