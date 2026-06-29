import { NextRequest, NextResponse } from "next/server";

/** Build the public tracking URL for a given courier */
function buildTrackingUrl(courier: string, awb: string): string {
  const c = courier.toLowerCase();
  if (c.includes("delhivery") || c.includes("dlv")) {
    return `https://www.delhivery.com/track/package/${awb}`;
  }
  if (c.includes("xpress") || c.includes("xpressbees")) {
    return `https://www.xpressbees.com/shipment/tracking?awbNo=${awb}`;
  }
  if (c.includes("bluedart")) {
    return `https://www.bluedart.com/tracking?trackfor=delivery&trackno=${awb}`;
  }
  if (c.includes("ekart") || c.includes("flipkart")) {
    return `https://ekartlogistics.com/shipmenttrack/${awb}`;
  }
  if (c.includes("ecom") || c.includes("ecomexpress")) {
    return `https://ecomexpress.in/tracking/?awb_field=${awb}`;
  }
  if (c.includes("shadowfax")) {
    return `https://tracker.shadowfax.in/?reference_number=${awb}`;
  }
  return "";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const awb = searchParams.get("awb");
  const courier = (searchParams.get("courier") || "").toLowerCase();

  if (!awb) {
    return NextResponse.json({ error: "AWB number required" }, { status: 400 });
  }

  const trackingUrl = buildTrackingUrl(courier, awb);

  try {
    // ─── Delhivery ─── has a free public JSON API
    if (courier.includes("delhivery") || courier.includes("dlv")) {
      const res = await fetch(
        `https://api.delhivery.com/api/status/packages/json/?waybill=${awb}&token=public`,
        { headers: { Accept: "application/json" }, next: { revalidate: 60 } }
      );
      const json = await res.json();
      const shipment = json?.ShipmentData?.[0]?.Shipment;

      if (!shipment) {
        const errorMsg = json?.message || "No shipment data found";
        return NextResponse.json({
          awb, courier: "Delhivery", trackingUrl,
          error: errorMsg,
          status: "Unknown", statusType: "", lastScan: "",
          lastLocation: "", lastDateTime: "", dispatchCount: 0, scans: [],
        });
      }

      const scans: Array<{ dateTime: string; scan: string; location: string; instructions: string }> =
        (shipment.Scans || []).map((sc: any) => ({
          dateTime: sc.ScanDetail?.ScanDateTime ?? "",
          scan: sc.ScanDetail?.Scan ?? "",
          location: sc.ScanDetail?.ScannedLocation ?? "",
          instructions: sc.ScanDetail?.Instructions ?? "",
        }));

      return NextResponse.json({
        awb,
        courier: "Delhivery",
        trackingUrl,
        status: shipment.Status?.Status ?? "",
        statusType: shipment.Status?.StatusType ?? "",
        lastScan: scans[scans.length - 1]?.scan ?? "",
        lastLocation: scans[scans.length - 1]?.location ?? "",
        lastDateTime: shipment.Status?.StatusDateTime ?? "",
        dispatchCount: shipment.dispatchCount ?? 0,
        scans: scans.slice(-8),
      });
    }

    // ─── XpressBees ─── no public JSON API, return redirect-only response
    if (courier.includes("xpress") || courier.includes("xpressbees")) {
      return NextResponse.json({
        awb,
        courier: "XpressBees",
        trackingUrl,
        status: "Check Live",
        statusType: "REDIRECT",
        lastScan: "",
        lastLocation: "",
        lastDateTime: "",
        dispatchCount: 0,
        scans: [],
        note: "XpressBees does not offer a public tracking API. Click the button below to view live tracking on their website.",
      });
    }

    // ─── Other couriers ─── return tracking URL only
    return NextResponse.json({
      awb,
      courier,
      trackingUrl,
      status: "Check Live",
      statusType: "REDIRECT",
      lastScan: "",
      lastLocation: "",
      lastDateTime: "",
      dispatchCount: 0,
      scans: [],
      note: `Live tracking not available inline for ${courier}. Use the tracking link below.`,
    });

  } catch (err: any) {
    return NextResponse.json({
      awb, courier, trackingUrl,
      error: err.message,
      status: "Error", statusType: "", lastScan: "",
      lastLocation: "", lastDateTime: "", dispatchCount: 0, scans: [],
    });
  }
}
