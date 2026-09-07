'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeContent />
    </Suspense>
  );
}

function UnsubscribeContent() {
  const params = useSearchParams();
  const id = params.get('id');
  const token = params.get('token');
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  async function handleUnsubscribe() {
    setState('loading');
    try {
      const res = await fetch('/api/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, token }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Something went wrong');
      setState('done');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
      setState('error');
    }
  }

  if (!id || !token) {
    return (
      <Shell>
        <p className="text-slate-600">This unsubscribe link is missing required information.</p>
      </Shell>
    );
  }

  return (
    <Shell>
      {state === 'done' ? (
        <>
          <h1 className="text-xl font-semibold text-slate-900">You&apos;re unsubscribed</h1>
          <p className="mt-2 text-sm text-slate-600">
            You won&apos;t receive any further emails from us. Sorry to see you go.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-xl font-semibold text-slate-900">Unsubscribe from future emails</h1>
          <p className="mt-2 text-sm text-slate-600">
            Click the button below to stop receiving emails from us. This action is immediate and
            permanent for this address.
          </p>
          {state === 'error' && (
            <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{errorMessage}</p>
          )}
          <button
            onClick={handleUnsubscribe}
            disabled={state === 'loading'}
            className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {state === 'loading' ? 'Unsubscribing…' : 'Unsubscribe me'}
          </button>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-sm text-center">
        {children}
      </div>
    </div>
  );
}
