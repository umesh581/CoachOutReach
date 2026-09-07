import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { PROSPECT_STAGES, STAGE_LABELS, type ProspectStage } from '@/lib/types';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: prospects }, { data: campaigns }] = await Promise.all([
    supabase.from('prospects').select('id, name, stage, campaign_id'),
    supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
  ]);

  const prospectNameById = new Map((prospects ?? []).map((p) => [p.id, p.name]));
  const prospectIds = (prospects ?? []).map((p) => p.id);

  const { data: rawActivities } =
    prospectIds.length > 0
      ? await supabase
          .from('activities')
          .select('*')
          .in('prospect_id', prospectIds)
          .order('created_at', { ascending: false })
          .limit(15)
      : { data: [] };

  const activities = (rawActivities ?? []).map((a) => ({
    ...a,
    prospectName: prospectNameById.get(a.prospect_id) ?? 'Unknown prospect',
  }));

  const counts: Record<ProspectStage, number> = Object.fromEntries(
    PROSPECT_STAGES.map((s) => [s, 0]),
  ) as Record<ProspectStage, number>;
  for (const p of prospects ?? []) {
    counts[p.stage as ProspectStage] = (counts[p.stage as ProspectStage] ?? 0) + 1;
  }
  const total = prospects?.length ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Pipeline overview across all campaigns.</p>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Pipeline ({total} prospects)
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-9">
          {PROSPECT_STAGES.map((stage) => (
            <Link
              key={stage}
              href={`/prospects?stage=${stage}`}
              className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm hover:border-slate-300"
            >
              <p className="text-2xl font-semibold text-slate-900">{counts[stage]}</p>
              <p className="mt-1 text-xs text-slate-500">{STAGE_LABELS[stage]}</p>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Campaigns</h2>
            <Link href="/campaigns" className="text-sm font-medium text-slate-700 hover:underline">
              View all
            </Link>
          </div>
          {campaigns && campaigns.length > 0 ? (
            <ul className="divide-y divide-slate-100">
              {campaigns.slice(0, 6).map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{c.name}</p>
                    <p className="text-xs text-slate-500">
                      {c.niche || 'No niche set'} · {c.target_country || '—'}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : c.status === 'paused'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {c.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">
              No campaigns yet.{' '}
              <Link href="/campaigns" className="font-medium text-slate-700 hover:underline">
                Create one
              </Link>
              .
            </p>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recent activity
          </h2>
          {activities && activities.length > 0 ? (
            <ul className="space-y-3">
              {activities.map((a) => (
                <li key={a.id} className="text-sm">
                  <p className="text-slate-800">
                    <span className="font-medium">{a.prospectName}</span>{' '}
                    — {a.note || a.type}
                  </p>
                  <p className="text-xs text-slate-400">{formatDateTime(a.created_at)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-500">No activity yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
