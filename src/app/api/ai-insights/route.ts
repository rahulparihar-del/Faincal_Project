import { NextRequest, NextResponse } from "next/server";

// POST /api/ai-insights
// Body: { summary: object }  — compact analytics JSON from the Meesho Payments tab.
// Returns: { insights: string }
//
// Provider priority:
//   1. OPENROUTER_API_KEY  (+ optional OPENROUTER_MODEL, default: free-tier friendly model)
//   2. ANTHROPIC_API_KEY   (+ optional ANTHROPIC_BASE_URL, ANTHROPIC_MODEL)

const SYSTEM_PROMPT = `You are a sharp e-commerce business analyst for a small Indian Meesho seller (baby clothes brand "KiddieKa").
You receive aggregated weekly/monthly numbers: orders, delivered, returns/RTO, payment received (INR), upcoming payments, ads spend, and net profit.

Write a short, practical analysis in simple Hinglish-friendly English (the seller speaks Hindi+English). Structure:
1. **Growth** — kya badh raha hai, kya gir raha hai (orders & payments week-over-week / month-over-month, with numbers and %).
2. **Profit / Loss** — net after ads; is ads spend justified? Ads as % of payments.
3. **Returns** — return/RTO rate; which SKUs are the problem.
4. **Action items** — 3-4 concrete suggestions (e.g. pause/scale specific ads, fix sizing info on high-return SKUs, best days to push ads).

Rules: use ₹ for amounts, round numbers, be direct and honest (loss ho raha hai to bolo), keep it under 350 words. No generic advice — only what the data shows.`;

interface AIRequestBody {
  summary?: unknown;
}

export async function POST(req: NextRequest) {
  let body: AIRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body.summary) {
    return NextResponse.json({ error: "Missing 'summary' in body" }, { status: 400 });
  }

  const userContent = `Here is my Meesho business data (JSON):\n\n${JSON.stringify(body.summary, null, 1)}\n\nAnalyse growth, profit/loss, returns and give action items.`;

  const openrouterKey = process.env.OPENROUTER_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  try {
    if (openrouterKey) {
      const model = process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-haiku";
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openrouterKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userContent },
          ],
          max_tokens: 1200,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json(
          { error: `OpenRouter error (${res.status}): ${errText.slice(0, 300)}` },
          { status: 502 }
        );
      }
      const json = await res.json();
      const insights: string = json?.choices?.[0]?.message?.content ?? "";
      if (!insights) {
        return NextResponse.json({ error: "OpenRouter returned an empty response" }, { status: 502 });
      }
      return NextResponse.json({ insights, provider: `openrouter:${model}` });
    }

    if (anthropicKey) {
      const baseUrl = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/$/, "");
      const model = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
      const res = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          max_tokens: 1200,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userContent }],
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json(
          { error: `Anthropic error (${res.status}): ${errText.slice(0, 300)}` },
          { status: 502 }
        );
      }
      const json = await res.json();
      const insights: string = Array.isArray(json?.content)
        ? json.content
            .filter((b: { type?: string }) => b.type === "text")
            .map((b: { text?: string }) => b.text ?? "")
            .join("\n")
        : "";
      if (!insights) {
        return NextResponse.json({ error: "Anthropic returned an empty response" }, { status: 502 });
      }
      return NextResponse.json({ insights, provider: `anthropic:${model}` });
    }

    return NextResponse.json(
      {
        error:
          "No AI key configured. Add OPENROUTER_API_KEY (or ANTHROPIC_API_KEY) to .env.local and restart the dev server.",
      },
      { status: 501 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: `AI request failed: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }
}
