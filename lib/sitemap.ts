import { XMLParser } from "fast-xml-parser";

type SitemapUrl = {
  loc: string;
  lastmod?: string;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
});

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function normalizeUrl(url: string) {
  try {
    return new URL(url).toString();
  } catch {
    return null;
  }
}

export async function fetchSitemapUrls(sitemapUrl: string, limit = 500): Promise<SitemapUrl[]> {
  const response = await fetch(sitemapUrl, {
    headers: { "user-agent": "SEO-GEO-Visibility-Dashboard/1.0" },
    signal: AbortSignal.timeout(20000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch sitemap: HTTP ${response.status}`);
  }

  const xml = await response.text();
  const parsed = parser.parse(xml);

  const nestedSitemaps = asArray<{ loc?: string }>(parsed?.sitemapindex?.sitemap)
    .map((item) => item.loc)
    .filter((loc): loc is string => Boolean(loc))
    .slice(0, 10);

  if (nestedSitemaps.length > 0) {
    const batches = await Promise.allSettled(nestedSitemaps.map((url) => fetchSitemapUrls(url, Math.ceil(limit / nestedSitemaps.length))));
    return batches.flatMap((batch) => batch.status === "fulfilled" ? batch.value : []).slice(0, limit);
  }

  const urls = asArray<{ loc?: string; lastmod?: string }>(parsed?.urlset?.url)
    .flatMap((item): SitemapUrl[] => {
      const loc = item.loc ? normalizeUrl(item.loc) : null;
      return loc ? [{ loc, lastmod: item.lastmod }] : [];
    })
    .slice(0, limit);
  return urls;
}

export function pathFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return "/";
  }
}
