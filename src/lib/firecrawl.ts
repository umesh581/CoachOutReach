const FIRECRAWL_API_URL = 'https://api.firecrawl.dev/v1/scrape';

export interface FirecrawlScrapeResult {
  success: boolean;
  markdown: string | null;
  html: string | null;
  metadata: Record<string, unknown> | null;
  raw: unknown;
}

/**
 * Scrapes a single URL via Firecrawl's /scrape endpoint and returns the
 * main content plus metadata (title, description, etc.). Throws on
 * non-2xx responses so callers can surface a clear error to the UI.
 */
export async function scrapeUrl(url: string, apiKey: string): Promise<FirecrawlScrapeResult> {
  const res = await fetch(FIRECRAWL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ['markdown', 'html'],
      onlyMainContent: true,
    }),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const message = json?.error || json?.message || `Firecrawl request failed (${res.status})`;
    throw new Error(message);
  }

  return {
    success: Boolean(json?.success ?? true),
    markdown: json?.data?.markdown ?? null,
    html: json?.data?.html ?? null,
    metadata: json?.data?.metadata ?? null,
    raw: json,
  };
}
