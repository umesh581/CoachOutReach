import { signIn, signUp } from './actions';

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string; message?: string; redirectTo?: string };
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Outreach Engine</h1>
          <p className="mt-1 text-sm text-slate-500">
            Sourcing, funnel analysis, and outreach for coaches &amp; consultants.
          </p>
        </div>

        <form action={signIn} className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <input type="hidden" name="redirectTo" value={searchParams.redirectTo || '/dashboard'} />

          {searchParams.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
          )}
          {searchParams.message && (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{searchParams.message}</p>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Sign in
          </button>

          <button
            type="submit"
            formAction={signUp}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Create account
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-slate-400">
          Single-user MVP — the first account you create owns all data.
        </p>
      </div>
    </div>
  );
}
