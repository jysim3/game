// Netlify Function: /\.netlify\/functions\/quotes?symbols=AAA,BBB
// Server-side proxy for Yahoo Finance quotes (avoids browser CORS issues).

const YAHOO_URL = "https://query1.finance.yahoo.com/v7/finance/quote";

export const handler = async (event) => {
  try {
    const symbolsRaw = event.queryStringParameters?.symbols || "";
    const symbols = symbolsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);

    if (symbols.length === 0) {
      return json(400, { error: "Missing symbols" });
    }

    const url = `${YAHOO_URL}?symbols=${encodeURIComponent(symbols.join(","))}`;

    const res = await fetch(url, {
      headers: {
        // Some edge environments are picky; a UA helps reliability.
        "user-agent": "Mozilla/5.0 (OpenClaw Netlify Function)",
        accept: "application/json,text/plain,*/*",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return json(502, { error: `Yahoo quote failed (${res.status})`, details: text.slice(0, 500) });
    }

    const data = await res.json();
    const results = data?.quoteResponse?.result || [];

    const quotes = {};
    for (const r of results) {
      if (r?.symbol) quotes[r.symbol] = r;
    }

    return json(200, { quotes });
  } catch (e) {
    return json(500, { error: e?.message || String(e) });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Allow same-origin + local dev.
      "access-control-allow-origin": "*",
    },
    body: JSON.stringify(body),
  };
}
