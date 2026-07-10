import { NextRequest, NextResponse } from "next/server";

// POST /api/roadmap/test-connection
// Body: { accountId: string, accessToken: string }
export async function POST(req: NextRequest) {
  let body: { accountId?: string; accessToken?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { accountId, accessToken } = body;

  if (!accountId || !accessToken) {
    return NextResponse.json({ error: "Missing Account ID or Access Token" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${accountId}?fields=username,name,profile_picture_url&access_token=${accessToken}`
    );
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.error?.message || "Failed to authenticate with Meta Graph API." },
        { status: res.status }
      );
    }

    return NextResponse.json({
      success: true,
      username: data.username,
      name: data.name,
      profilePictureUrl: data.profile_picture_url,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Fetch failed: " + (err instanceof Error ? err.message : String(err)) },
      { status: 502 }
    );
  }
}
