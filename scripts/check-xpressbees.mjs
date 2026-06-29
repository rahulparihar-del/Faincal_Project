// Try to find XpressBees internal tracking API endpoints
const awb = "2340969457730";

// Try their internal API that the SPA uses
const endpoints = [
  // Common internal patterns
  `https://www.xpressbees.com/api/v1/track/${awb}`,
  `https://www.xpressbees.com/api/v2/track/${awb}`,
  `https://www.xpressbees.com/trackship/${awb}`,
  // Their known public shipment tracking endpoint
  `https://shipment.xpressbees.com/api/shipments2/track_me/${awb}`,
  `https://shipment.xpressbees.com/api/track/${awb}`,
  // Meesho uses XpressBees - maybe through meesho's proxy
  `https://tracking.xpressbees.com/track?awb=${awb}`,
  // Internal API with fake origin
];

for (const url of endpoints) {
  try {
    const res = await fetch(url, {
      headers: {
        "Accept": "application/json",
        "Origin": "https://www.xpressbees.com",
        "Referer": `https://www.xpressbees.com/shipment/tracking?awbNo=${awb}`,
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      }
    });
    const text = await res.text();
    console.log(`[${res.status}] ${url}`);
    if (!text.includes('<!doctype')) {
      console.log(text.slice(0, 600));
    } else {
      console.log("(HTML SPA page)");
    }
  } catch (err) {
    console.log(`ERROR: ${url} → ${err.message}`);
  }
}
