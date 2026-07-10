import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// POST /api/roadmap/publish
// Body: { nodeId?: string }
// If nodeId is provided, publish that specific node.
// If nodeId is not provided, publish all scheduled nodes where dueDate <= today.
export async function POST(req: NextRequest) {
  const host = req.headers.get("host") || "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const baseUrl = `${protocol}://${host}`;

  let body: { nodeId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Ignore error, might be empty POST
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase connection not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // Fetch Instagram Config from roadmap_projects table
  const { data: configRow, error: configError } = await supabase
    .from("roadmap_projects")
    .select("data")
    .eq("id", "instagram_config")
    .maybeSingle();

  if (configError || !configRow || !configRow.data) {
    return NextResponse.json(
      { error: "Instagram credentials not configured. Please link your account in settings." },
      { status: 400 }
    );
  }

  const { accountId, accessToken } = configRow.data;

  if (!accountId || !accessToken) {
    return NextResponse.json(
      { error: "Missing Instagram Account ID or Access Token in settings." },
      { status: 400 }
    );
  }

  // Find nodes to publish
  let nodesToPublish: any[] = [];

  if (body.nodeId) {
    // Publish a single specific node
    const { data: nodeRow, error: nodeError } = await supabase
      .from("roadmap_nodes")
      .select("id, data")
      .eq("id", body.nodeId)
      .single();

    if (nodeError || !nodeRow) {
      return NextResponse.json({ error: "Node not found" }, { status: 404 });
    }
    nodesToPublish = [nodeRow];
  } else {
    // Find all scheduled nodes where status === 'in-progress' and dueDate <= today
    const todayStr = new Date().toISOString().split("T")[0];
    const { data: nodeRows, error: nodesError } = await supabase
      .from("roadmap_nodes")
      .select("id, data");

    if (nodesError || !nodeRows) {
      return NextResponse.json({ error: "Failed to query nodes" }, { status: 500 });
    }

    nodesToPublish = nodeRows.filter((row) => {
      const node = row.data || {};
      return (
        node.projectId === "instagram" &&
        node.status === "in-progress" &&
        node.dueDate &&
        node.dueDate <= todayStr
      );
    });
  }

  if (nodesToPublish.length === 0) {
    return NextResponse.json({ message: "No scheduled posts found to publish." });
  }

  const results = [];

  for (const row of nodesToPublish) {
    const nodeId = row.id;
    const node = row.data || {};
    const images = node.imageUrls && node.imageUrls.length > 0
      ? node.imageUrls
      : node.imageUrl
        ? [node.imageUrl]
        : [];

    if (images.length === 0) {
      results.push({ nodeId, title: node.title, success: false, error: "No image attached to this post." });
      continue;
    }

    // Format caption (strip HTML and append hashtags)
    const plainCaption = node.richContent
      ? node.richContent.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]*>/g, " ")
      : "";
    const tagsSuffix = node.tags && node.tags.length > 0
      ? "\n\n" + node.tags.map((t: string) => `#${t}`).join(" ")
      : "";
    const caption = `${node.title || ""}\n${plainCaption}${tagsSuffix}`.trim();

    try {
      let creationId = "";

      if (images.length === 1) {
        // Single Image publish
        const imageUrl = images[0].startsWith("data:")
          ? `${baseUrl}/api/roadmap/image?nodeId=${nodeId}&index=0`
          : images[0];

        const containerRes = await fetch(
          `https://graph.facebook.com/v19.0/${accountId}/media`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image_url: imageUrl,
              caption: caption,
              access_token: accessToken,
            }),
          }
        );

        const containerJson = await containerRes.json();
        if (!containerRes.ok || !containerJson.id) {
          throw new Error(containerJson.error?.message || "Failed to create media container.");
        }
        creationId = containerJson.id;
      } else {
        // Carousel post
        const childrenIds = [];
        
        // 1. Create container for each image
        for (let i = 0; i < images.length; i++) {
          const imageUrl = images[i].startsWith("data:")
            ? `${baseUrl}/api/roadmap/image?nodeId=${nodeId}&index=${i}`
            : images[i];

          const itemRes = await fetch(
            `https://graph.facebook.com/v19.0/${accountId}/media`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image_url: imageUrl,
                is_carousel_item: true,
                access_token: accessToken,
              }),
            }
          );

          const itemJson = await itemRes.json();
          if (!itemRes.ok || !itemJson.id) {
            throw new Error(itemJson.error?.message || `Failed to create carousel slide ${i + 1} container.`);
          }
          childrenIds.push(itemJson.id);
        }

        // 2. Create parent Carousel container
        const carouselRes = await fetch(
          `https://graph.facebook.com/v19.0/${accountId}/media`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              media_type: "CAROUSEL",
              caption: caption,
              children: childrenIds,
              access_token: accessToken,
            }),
          }
        );

        const carouselJson = await carouselRes.json();
        if (!carouselRes.ok || !carouselJson.id) {
          throw new Error(carouselJson.error?.message || "Failed to create parent carousel container.");
        }
        creationId = carouselJson.id;
      }

      // 3. Publish the container
      // Wait 3 seconds to let Facebook's servers fetch the images
      await new Promise((r) => setTimeout(r, 3000));

      const publishRes = await fetch(
        `https://graph.facebook.com/v19.0/${accountId}/media_publish`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            creation_id: creationId,
            access_token: accessToken,
          }),
        }
      );

      const publishJson = await publishRes.json();
      if (!publishRes.ok || !publishJson.id) {
        throw new Error(publishJson.error?.message || "Failed to publish media container.");
      }

      const instagramPostId = publishJson.id;

      // 4. Update the node status in database to 'done' (Published)
      const updatedNode = {
        ...node,
        status: "done",
        instagramPostId: instagramPostId,
        publishedAt: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("roadmap_nodes")
        .update({ data: updatedNode })
        .eq("id", nodeId);

      if (updateError) {
        throw new Error("Published but failed to update status in local database: " + updateError.message);
      }

      results.push({
        nodeId,
        title: node.title,
        success: true,
        instagramPostId,
        warning: host.startsWith("localhost")
          ? "Running on localhost. If the images failed to load, make sure they are public internet URLs or deploy the app so Instagram can access your local uploads."
          : undefined,
      });
    } catch (err) {
      results.push({
        nodeId,
        title: node.title,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return NextResponse.json({ results });
}
