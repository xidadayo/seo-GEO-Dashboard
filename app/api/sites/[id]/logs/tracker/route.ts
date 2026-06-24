import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const collectUrl = new URL(`/api/sites/${id}/logs/collect`, request.url).toString();
  const script = `
(function () {
  try {
    var payload = {
      url: window.location.href,
      referer: document.referrer || ""
    };
    if (navigator.sendBeacon) {
      navigator.sendBeacon("${collectUrl}", new Blob([JSON.stringify(payload)], { type: "application/json" }));
      return;
    }
    fetch("${collectUrl}", {
      method: "POST",
      mode: "cors",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(function () {});
  } catch (error) {}
})();
`.trim();

  return new NextResponse(script, {
    headers: {
      "content-type": "application/javascript; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
