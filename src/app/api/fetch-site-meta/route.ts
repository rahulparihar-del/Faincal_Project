import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url param" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BizTrack/1.0; bookmark-fetcher)",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();

    // --- helpers ---
    const tag = (attr: string, name: string) => {
      const re = new RegExp(
        `<meta[^>]+${attr}=["']${name}["'][^>]+content=["']([^"']+)["']`,
        "i"
      );
      const m = html.match(re);
      if (m) return m[1];
      const re2 = new RegExp(
        `<meta[^>]+content=["']([^"']+)["'][^>]+${attr}=["']${name}["']`,
        "i"
      );
      const m2 = html.match(re2);
      return m2 ? m2[1] : null;
    };

    // Title
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title =
      tag("property", "og:title") ||
      tag("name", "twitter:title") ||
      (titleMatch ? titleMatch[1].trim() : null) ||
      new URL(url).hostname;

    // Description
    const description =
      tag("property", "og:description") ||
      tag("name", "description") ||
      tag("name", "twitter:description") ||
      "";

    // Favicon
    const base = new URL(url);
    const faviconMatch = html.match(
      /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i
    ) || html.match(
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["']/i
    );
    let favicon = faviconMatch ? faviconMatch[1] : null;
    if (favicon && !favicon.startsWith("http")) {
      favicon = favicon.startsWith("//")
        ? `${base.protocol}${favicon}`
        : `${base.origin}${favicon.startsWith("/") ? "" : "/"}${favicon}`;
    }
    // fallback to Google's favicon service
    if (!favicon) {
      favicon = `https://www.google.com/s2/favicons?domain=${base.hostname}&sz=64`;
    }

    // OG Image
    const ogImage =
      tag("property", "og:image") || tag("name", "twitter:image") || null;

    return NextResponse.json({
      title: title?.slice(0, 80),
      description: description?.slice(0, 200),
      favicon,
      ogImage,
      hostname: base.hostname,
    });
  } catch (err) {
    const hostname = (() => {
      try { return new URL(url).hostname; } catch { return url; }
    })();
    return NextResponse.json({
      title: hostname,
      description: "",
      favicon: `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`,
      ogImage: null,
      hostname,
      error: String(err),
    });
  }
}
