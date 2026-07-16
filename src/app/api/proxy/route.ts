import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get("url");

  if (!urlParam) {
    return new Response("Missing url parameter", { status: 400 });
  }

  try {
    // Validate URL
    const targetUrl = new URL(urlParam);

    // Fetch the target URL
    const response = await fetch(targetUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      return new Response(
        `Failed to fetch site: ${response.status} ${response.statusText}`,
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "";

    // If it's HTML, we need to inject the <base> tag to fix relative links and paths
    if (contentType.includes("text/html")) {
      let html = await response.text();

      // We resolve the base URL using the target URL
      const baseHref = targetUrl.href;
      const baseTag = `<base href="${baseHref}" />`;

      // Insert base tag right after <head> or at the beginning
      if (html.includes("<head>")) {
        html = html.replace("<head>", `<head>${baseTag}`);
      } else if (html.includes("<HEAD>")) {
        html = html.replace("<HEAD>", `<HEAD>${baseTag}`);
      } else {
        html = baseTag + html;
      }

      // Return the proxied HTML response with clean headers (no frame-ancestors / x-frame-options blocking)
      return new Response(html, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      });
    }

    // For other assets (e.g. image, css, js) if they are requested directly
    const body = await response.blob();
    return new Response(body, {
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    return new Response(
      `Error proxying site preview: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { status: 500 }
    );
  }
}
