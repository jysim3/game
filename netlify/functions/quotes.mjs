// Netlify Function: /.netlify/functions/quotes?symbols=AAA,BBB
// Uses SerpAPI Google Finance engine to fetch price + daily % change.

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";

export const handler = async (event) => {
  try {
    const apiKey = process.env.SERPAPI_API_KEY;
    if (!apiKey) {
      return json(500, {
        error:
          "Missing SERPAPI_API_KEY env var. Add it in Netlify site env vars before quotes will work.",
      });
    }

    const symbolsRaw = event.queryStringParameters?.symbols || "";
    const symbols = symbolsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30);

    if (symbols.length === 0) {
      return json(400, { error: "Missing symbols" });
    }

    const quotes = {};

    // NOTE: SerpAPI Google Finance is per-quote; we fan out.
    await Promise.all(
      symbols.map(async (sym) => {
        const q = toGoogleFinanceQuery(sym);
        const url = `${SERPAPI_ENDPOINT}?engine=google_finance&hl=en&q=${encodeURIComponent(q)}&api_key=${encodeURIComponent(apiKey)}`;

        const res = await fetch(url, {
          headers: {
            "user-agent": "Mozilla/5.0 (OpenClaw Netlify Function)",
            accept: "application/json,text/plain,*/*",
          },
        });

        if (!res.ok) {
          quotes[sym] = { error: `SerpAPI failed (${res.status})` };
          return;
        }

        const data = await res.json();

        const price = parsePrice(data?.ticker_data?.current_price);
        const changePct =
          parsePct(
            data?.ticker_data?.price_change?.percentage ??
              data?.ticker_data?.price_change?.percentage_change ??
              data?.ticker_data?.price_change,
          ) ??
          parsePct(data?.price_movement?.percentage);

        quotes[sym] = {
          symbol: sym,
          regularMarketPrice: price ?? undefined,
          regularMarketChangePercent: changePct ?? undefined,
          currency: data?.ticker_data?.currency || undefined,
          regularMarketTime: Math.floor(Date.now() / 1000),
          _q: q,
        };
      }),
    );

    return json(200, { quotes });
  } catch (e) {
    return json(500, { error: e?.message || String(e) });
  }
};

function toGoogleFinanceQuery(sym) {
  // SerpAPI expects ticker:exchange, e.g. "NAB:ASX" (not "ASX:NAB").
  if (sym.includes(":")) return sym;

  const m = sym.match(/^(.+)\.(AX|SI|HK|KL)$/i);
  if (!m) return sym;

  const ticker = m[1];
  const suffix = m[2].toUpperCase();

  const exch =
    suffix === "AX"
      ? "ASX"
      : suffix === "SI"
        ? "SGX"
        : suffix === "HK"
          ? "HKG"
          : suffix === "KL"
            ? "KLSE"
            : undefined;

  return exch ? `${ticker}:${exch}` : sym;
}

function parsePrice(v) {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  const n = Number(v.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parsePct(v) {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  const n = Number(v.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
    },
    body: JSON.stringify(body),
  };
}
