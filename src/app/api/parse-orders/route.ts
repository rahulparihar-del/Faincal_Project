import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { pages } = await req.json();

    if (!pages || !Array.isArray(pages) || pages.length === 0) {
      return NextResponse.json({ error: "Missing or invalid pages array in request body" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Anthropic API Key not configured on the server" }, { status: 500 });
    }

    let baseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/";
    if (!baseUrl.endsWith("/")) {
      baseUrl += "/";
    }

    const endpoint = `${baseUrl}v1/messages`;

    const systemPrompt = `You are an expert order processing system that extracts and matches orders from Meesho PDF documents.
You will be provided with a list of pages from a Meesho PDF document. Some pages are shipping labels (supplied as images or text), and other pages are tax invoices (supplied as text or images).

Your goal is to:
1. Parse every page to extract order details.
2. Match shipping label details with their corresponding tax invoice details by matching the order number (usually a 13-18 digit number, e.g. 300712423978317195).
3. If a shipping label page has no matching tax invoice page (or vice versa), you should still extract and output it as a standalone order with whatever fields you can find.
4. Combine the customer details, SKU, and courier from the shipping label with the pricing, discount, and product name from the tax invoice into a single merged order.
5. Output a clean, structured JSON array of matched/extracted orders.

For each order, extract and combine the following fields:
- "orderNo": Meesho order number (usually 13-18 digits, e.g., 300712423978317195. Strip any trailing _1 or _2 if matching, but return the canonical order number).
- "invoiceNo": Alphanumeric tax invoice number (from the invoice page).
- "customerName": Customer's full name.
- "customerAddress": Customer's delivery address (excluding city, state, pincode).
- "customerCity": Customer's city/state.
- "customerPincode": 6-digit postal code.
- "sku": Seller SKU code (e.g. BOY-PANT-RED-3Y).
- "productName": Full product name/description.
- "size": Size (e.g. 3-4 Years, Free Size).
- "color": Color (if specified).
- "qty": Quantity (number, defaults to 1).
- "grossAmount": Taxable value / gross amount before discount/taxes (number).
- "discount": Discount amount (number).
- "tax": GST/IGST/tax amount (number).
- "sellingPrice": Final selling price paid by customer (number).
- "paymentType": Either "Prepaid" or "COD".
- "courier": Courier name (e.g., Delhivery, Xpress Bees, Shadowfax, Valmo, etc.).
- "pageNos": Array of page numbers (1-indexed) that correspond to this order (e.g. [1, 2] if page 1 was the shipping label and page 2 was the invoice).

Respond ONLY with a valid JSON array of objects matching this schema. Do not include markdown formatting, explanations, or any text outside the JSON.`;

    const content: any[] = [];
    content.push({
      type: "text",
      text: "Below are the pages of a Meesho orders PDF. Please extract the orders, match shipping labels with invoices by order number, and output a structured JSON array of matched orders."
    });

    for (const page of pages) {
      content.push({
        type: "text",
        text: `\n--- PAGE ${page.pageNo} ---`
      });

      if (page.image) {
        const match = page.image.match(/^data:(image\/[a-z]+);base64,(.*)$/);
        if (match) {
          content.push({
            type: "image",
            source: {
              type: "base64",
              media_type: match[1],
              data: match[2]
            }
          });
        }
      }

      if (page.text) {
        content.push({
          type: "text",
          text: `Page Text:\n${page.text}`
        });
      }
    }

    const payload = {
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: content
        }
      ]
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: `Anthropic API error: HTTP ${res.status} - ${errorText}` }, { status: res.status });
    }

    const responseData = await res.json();
    let textResponse = responseData.content?.[0]?.text || "";

    // Robust parsing of JSON from text
    textResponse = textResponse.trim();
    const jsonMatch = textResponse.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (jsonMatch) {
      textResponse = jsonMatch[0];
    } else {
      const genericJsonMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/) || textResponse.match(/```\s*([\s\S]*?)\s*```/);
      if (genericJsonMatch) {
        textResponse = genericJsonMatch[1].trim();
      }
    }

    try {
      const parsedData = JSON.parse(textResponse);
      return NextResponse.json(parsedData);
    } catch (parseErr) {
      console.error("Failed to parse Claude output as JSON array:", textResponse, parseErr);
      return NextResponse.json({ error: "Failed to parse structured JSON from model response", rawResponse: textResponse }, { status: 500 });
    }

  } catch (err) {
    console.error("Error in parse-orders route handler:", err);
    return NextResponse.json({ error: `Internal server error: ${String(err)}` }, { status: 500 });
  }
}
