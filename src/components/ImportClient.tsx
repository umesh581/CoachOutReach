'use client';

import { useState } from 'react';
import Papa from 'papaparse';
import { useRouter } from 'next/navigation';

type TargetKey = 'name' | 'company' | 'country' | 'linkedin_url' | 'website_url' | 'email';

const TARGET_FIELDS: { key: TargetKey; label: string; required?: boolean }[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'company', label: 'Company' },
  { key: 'country', label: 'Country (US/UK/AU)' },
  { key: 'linkedin_url', label: 'LinkedIn URL' },
  { key: 'website_url', label: 'Website URL' },
  { key: 'email', label: 'Email' },
];

// A handful of common header spellings from Apollo/Clay/Sales Navigator
// exports, used to pre-select a sensible mapping automatically.
const AUTO_MAP: Record<string, TargetKey> = {
  name: 'name',
  'full name': 'name',
  'first name': 'name',
  company: 'company',
  'company name': 'company',
  organization: 'company',
  country: 'country',
  linkedin: 'linkedin_url',
  'linkedin url': 'linkedin_url',
  'person linkedin url': 'linkedin_url',
  website: 'website_url',
  'website url': 'website_url',
  'company website': 'website_url',
  email: 'email',
  'email address': 'email',
};

export default function ImportClient({ campaigns }: { campaigns: { id: string; name: string }[] }) {
  const router = useRouter();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<TargetKey, string>>({} as Record<TargetKey, string>);
  const [campaignId, setCampaignId] = useState('');
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<null | {
    inserted: number;
    skipped_duplicate: number;
    skipped_no_name: number;
    total_rows: number;
  }>(null);
  const [error, setError] = useState('');

  function handleFile(file: File) {
    setFileName(file.name);
    setError('');
    setResult(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const fields = results.meta.fields ?? [];
        setHeaders(fields);
        setRows(results.data);

        const autoMapping: Record<TargetKey, string> = {} as Record<TargetKey, string>;
        for (const field of fields) {
          const match = AUTO_MAP[field.trim().toLowerCase()];
          if (match && !autoMapping[match]) autoMapping[match] = field;
        }
        setMapping(autoMapping);
      },
      error: (err) => setError(err.message),
    });
  }

  async function runImport() {
    if (!mapping.name) {
      setError('You must map a column to "Name" before importing.');
      return;
    }
    setImporting(true);
    setError('');
    try {
      const mappedRows = rows.map((row) => ({
        name: mapping.name ? row[mapping.name] : undefined,
        company: mapping.company ? row[mapping.company] : undefined,
        country: mapping.country ? row[mapping.country] : undefined,
        linkedin_url: mapping.linkedin_url ? row[mapping.linkedin_url] : undefined,
        website_url: mapping.website_url ? row[mapping.website_url] : undefined,
        email: mapping.email ? row[mapping.email] : undefined,
      }));

      const res = await fetch('/api/prospects/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: mappedRows, campaign_id: campaignId || null, source: 'csv' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setResult(json);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Import prospects</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload a CSV exported from Apollo, Clay, or Sales Navigator. We de-duplicate by email and
          LinkedIn URL against your existing prospects.
        </p>
      </div>

      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
        <input
          type="file"
          accept=".csv"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          className="mx-auto block text-sm"
        />
        {fileName && <p className="mt-2 text-xs text-slate-500">Loaded {fileName} — {rows.length} rows</p>}
      </div>

      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {headers.length > 0 && (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-700">Map columns</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {TARGET_FIELDS.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-slate-700">
                  {field.label}
                  {field.required && <span className="text-red-500"> *</span>}
                </label>
                <select
                  value={mapping[field.key] || ''}
                  onChange={(e) => setMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Don&apos;t import</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Assign to campaign</label>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              className="mt-1 w-full max-w-xs rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">No campaign</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-md border border-slate-100">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {TARGET_FIELDS.map((f) => (
                    <th key={f.key} className="px-2 py-1 text-left font-medium">
                      {f.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, i) => (
                  <tr key={i} className="border-t border-slate-100">
                    {TARGET_FIELDS.map((f) => (
                      <td key={f.key} className="px-2 py-1 text-slate-600">
                        {mapping[f.key] ? row[mapping[f.key]] : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400">Preview of first {Math.min(5, rows.length)} rows.</p>

          <button
            onClick={runImport}
            disabled={importing}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {importing ? 'Importing…' : `Import ${rows.length} rows`}
          </button>
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-medium">Import complete</p>
          <ul className="mt-1 list-disc pl-5">
            <li>{result.inserted} prospects added</li>
            <li>{result.skipped_duplicate} skipped as duplicates (existing email/LinkedIn URL)</li>
            <li>{result.skipped_no_name} skipped for missing a name</li>
          </ul>
        </div>
      )}
    </div>
  );
}
