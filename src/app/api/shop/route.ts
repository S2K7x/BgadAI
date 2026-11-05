/**
 * Optional product search for "shop the gap". Uses SerpApi's Google Shopping engine
 * when SERPAPI_API_KEY is set; otherwise the client falls back to search links.
 */
export async function GET(req: Request) {
  const key = process.env.SERPAPI_API_KEY;
  if (!key) return Response.json({ error: "Shopping search is not configured" }, { status: 503 });
  const q = new URL(req.url).searchParams.get("q")?.slice(0, 120).trim();
  if (!q) return Response.json({ error: "Missing q" }, { status: 400 });

  const params = new URLSearchParams({ engine: "google_shopping", q, api_key: key, num: "12" });
  const res = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!res.ok) return Response.json({ error: `Shopping search failed (${res.status})` }, { status: 502 });
  const data = (await res.json()) as {
    shopping_results?: { title?: string; price?: string; source?: string; link?: string; product_link?: string; thumbnail?: string }[];
  };
  const results = (data.shopping_results ?? [])
    .filter((r) => r.title && (r.link || r.product_link))
    .slice(0, 8)
    .map((r) => ({
      title: r.title!,
      price: r.price ?? "",
      source: r.source ?? "",
      link: (r.link || r.product_link)!,
      thumbnail: r.thumbnail ?? "",
    }));
  return Response.json({ results });
}
