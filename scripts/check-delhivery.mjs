// Get full Delhivery tracking details
const awbs = [
  { awb: "1490836447742246", suborder: "297654140024105408_1" },
  { awb: "1490836447743554", suborder: "297669825185610440_1" },
  { awb: "1490835650531146", suborder: "293964322900001472_1" },
];

async function checkDelhivery(awb, suborder) {
  const trackUrl = `https://api.delhivery.com/api/status/packages/json/?waybill=${awb}&token=public`;
  const res = await fetch(trackUrl, { headers: { "Accept": "application/json" } });
  const json = await res.json();
  const s = json?.ShipmentData?.[0]?.Shipment;
  if (!s) { console.log(`No data for ${awb}`); return; }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Suborder: ${suborder}`);
  console.log(`AWB: ${awb}`);
  console.log(`Status: ${s.Status?.Status}`);
  console.log(`Instructions: ${s.Status?.Instructions}`);
  console.log(`StatusDateTime: ${s.Status?.StatusDateTime}`);
  console.log(`StatusLocation: ${s.Status?.StatusLocation}`);
  console.log(`StatusType: ${s.Status?.StatusType}`);
  console.log(`Dispatch Count: ${s.dispatchCount}`);
  console.log(`\nScans (latest 5):`);
  const scans = s.Scans || [];
  scans.slice(-5).forEach(sc => {
    const d = sc.ScanDetail;
    console.log(`  ${d?.ScanDateTime} | ${d?.Scan} | ${d?.ScannedLocation} | ${d?.Instructions}`);
  });
}

for (const item of awbs) {
  await checkDelhivery(item.awb, item.suborder);
}
