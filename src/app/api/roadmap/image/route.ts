import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const nodeId = searchParams.get("nodeId");
  const indexStr = searchParams.get("index");

  if (!nodeId) {
    return new NextResponse("Missing nodeId", { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return new NextResponse("Database connection not configured", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: row, error } = await supabase
    .from("roadmap_nodes")
    .select("data")
    .eq("id", nodeId)
    .single();

  if (error || !row) {
    return new NextResponse("Node not found", { status: 404 });
  }

  const nodeData = row.data || {};
  const index = indexStr ? parseInt(indexStr, 10) : 0;
  
  let imageUrl = "";
  if (nodeData.imageUrls && nodeData.imageUrls.length > index) {
    imageUrl = nodeData.imageUrls[index];
  } else {
    imageUrl = nodeData.imageUrl || "";
  }

  if (!imageUrl) {
    return new NextResponse("No image found for this node", { status: 404 });
  }

  // If it's a Base64 string, decode and return it
  if (imageUrl.startsWith("data:")) {
    const matches = imageUrl.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return new NextResponse("Invalid Base64 format", { status: 400 });
    }
    const type = matches[1];
    const buffer = Buffer.from(matches[2], "base64");
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": `image/${type}`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  // Otherwise, proxy it so Instagram can fetch it without CORS/third-party access issues
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      return new NextResponse("Failed to fetch external image", { status: 502 });
    }
    const blob = await res.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": res.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return new NextResponse("Failed to proxy image: " + String(err), { status: 500 });
  }
}
