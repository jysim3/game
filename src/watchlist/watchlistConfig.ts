export type WatchSymbol = {
  symbol: string;
  name: string;
  market?: string;
  note?: string;
};

// Initial list based on Yang's dividend screen shortlist.
// You can edit this list anytime.
export const WATCHLIST: WatchSymbol[] = [
  { symbol: "NAB.AX", name: "National Australia Bank", market: "ASX" },
  { symbol: "WBC.AX", name: "Westpac Banking Corp", market: "ASX" },
  { symbol: "ANZ.AX", name: "ANZ Group", market: "ASX" },
  { symbol: "TLS.AX", name: "Telstra", market: "ASX" },

  // SGX tickers on Yahoo typically use .SI suffix
  { symbol: "D05.SI", name: "DBS Group", market: "SGX" },
  { symbol: "O39.SI", name: "OCBC", market: "SGX" },
  { symbol: "U11.SI", name: "UOB", market: "SGX" },

  { symbol: "0941.HK", name: "China Mobile", market: "HKEX" },
  { symbol: "0006.HK", name: "Power Assets", market: "HKEX" },

  // Bursa tickers on Yahoo typically use .KL suffix
  { symbol: "1155.KL", name: "Maybank", market: "Bursa" },
  { symbol: "5347.KL", name: "Tenaga Nasional", market: "Bursa" },
];
