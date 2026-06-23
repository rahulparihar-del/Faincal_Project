import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing page text in request body" }, { status: 400 });
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

    const systemPrompt = `You are an expert system that extracts structured e-commerce order data from Meesho PDF document text.
You will be given the raw text of a page from a Meesho document (which could be a shipping label or a tax invoice).
Your goal is to classify the page type and extract all relevant fields into a structured JSON response.

Determine the page type:
1. "shipping": If the text contains references to customer address, shipping labels, barcode details, courier names, prepaid/cod status, or typical shipping labels.
2. "invoice": If the text contains billing details, tax invoice headers, GSTIN, supply details, gross amounts, tax rates, CGST/SGST/IGST, or product tables with tax breakdowns.
3. "unknown": If the text doesn't contain enough information to be classified as a Meesho shipping label or tax invoice.

For "shipping" pages, extract:
- "orderNo": Meesho order number (usually 13-18 digits, e.g., 185638294719472 or similar. May have trailing underscore like _1 or suffix).
- "customerName": Customer's name.
- "customerAddress": Customer's delivery address (house number, street, landmark, area). Do NOT include city, state, or pincode here.
- "customerCity": Customer's city/town/state.
- "customerPincode": 6-digit PIN code.
- "sku": Seller SKU code (e.g., BOY-PANT-RED-3Y or similar).
- "size": Item size (e.g. Free Size, 3-4 Years, S, M, L, etc.).
- "color": Color if explicitly mentioned.
- "qty": Quantity (integer).
- "paymentType": Must be either "Prepaid" or "COD".
- "courier": Name of the delivery partner/courier (e.g., "Xpress Bees", "Delhivery", "Shadowfax", "Ecom Express", "BlueDart", "Valmo", "Ekart", etc.).
- "codAmount": The amount to collect if paymentType is COD (number). Set to 0 if Prepaid.

For "invoice" pages, extract:
- "orderNo": Purchase Order No / Order number (matching the order ID, e.g., 13-18 digits).
- "invoiceNo": Invoice number (usually alphanumeric code, e.g., INV-2026-102).
- "customerName": Name under "Bill To" or "Ship To".
- "customerAddress": Billing/shipping address. Do NOT include city, state, or pincode here.
- "customerCity": City/town/state.
- "customerPincode": 6-digit PIN code.
- "productName": Product name or description from the invoice table.
- "size": Size if mentioned in the product description (e.g. 3-4 Years).
- "grossAmount": Taxable value / gross amount before discount/taxes.
- "discount": Discount amount (if any).
- "tax": GST/IGST/tax amount.
- "total": Final total amount paid/payable (selling price).

Output must be ONLY a valid JSON object. Do not wrap it in markdown code blocks, do not write explanations.
If the page is unknown or empty, output:
{
  "type": "unknown"
}`;

    const payload = {
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Here is the page text to parse:\n\n${text}`
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
    const jsonMatch = textResponse.match(/```json\s*([\s\S]*?)\s*```/) || textResponse.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      textResponse = jsonMatch[1].trim();
    }

    try {
      const parsedData = JSON.parse(textResponse);
      return NextResponse.json(parsedData);
    } catch (parseErr) {
      console.error("Failed to parse Claude output as JSON:", textResponse, parseErr);
      return NextResponse.json({ error: "Failed to parse structured JSON from model response", rawResponse: textResponse }, { status: 500 });
    }

  } catch (err) {
    console.error("Error in parse-orders route handler:", err);
    return NextResponse.json({ error: `Internal server error: ${String(err)}` }, { status: 500 });
  }
}
