import { ReloadOutlined } from "@ant-design/icons";
import { Button, Card, Flex, Space, Table, Tag, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";
import { WATCHLIST, type WatchSymbol } from "../watchlist/watchlistConfig";

type YahooQuote = {
  symbol?: string;
  currency?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketTime?: number; // unix seconds
};

type QuoteRow = {
  symbol: string;
  name: string;
  market?: string;

  price?: number;
  currency?: string;
  changePct?: number; // regularMarketChangePercent
  updatedAtMs?: number;

  triggered: boolean;
};

const DEFAULT_TRIGGER_PCT = -6;

const fmtPct = (v?: number) => {
  if (v === undefined || Number.isNaN(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
};

const fmtNum = (v?: number) => {
  if (v === undefined || Number.isNaN(v)) return "—";
  return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
};

const WatchlistPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Record<string, YahooQuote>>({});
  const [lastUpdatedMs, setLastUpdatedMs] = useState<number | null>(null);

  const symbols = useMemo(() => WATCHLIST.map((w) => w.symbol), []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = `/.netlify/functions/quotes?symbols=${encodeURIComponent(symbols.join(","))}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Quote fetch failed (${res.status})`);
      const data = await res.json();
      setQuotes(data?.quotes || {});
      setLastUpdatedMs(Date.now());
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows: QuoteRow[] = useMemo(() => {
    return WATCHLIST.map((w: WatchSymbol) => {
      const q: YahooQuote | undefined = quotes[w.symbol];
      const changePct =
        typeof q?.regularMarketChangePercent === "number"
          ? q.regularMarketChangePercent
          : undefined;

      return {
        symbol: w.symbol,
        name: w.name,
        market: w.market,

        price:
          typeof q?.regularMarketPrice === "number" ? q.regularMarketPrice : undefined,
        currency: typeof q?.currency === "string" ? q.currency : undefined,
        changePct,
        updatedAtMs:
          typeof q?.regularMarketTime === "number" ? q.regularMarketTime * 1000 : undefined,

        triggered: changePct !== undefined ? changePct <= DEFAULT_TRIGGER_PCT : false,
      };
    }).sort((a, b) => {
      // Triggered first, then by most negative change
      if (a.triggered !== b.triggered) return a.triggered ? -1 : 1;
      return (a.changePct ?? 0) - (b.changePct ?? 0);
    });
  }, [quotes]);

  return (
    <div className="page">
      <Flex vertical gap={14}>
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>
            Watchlist trigger table
          </Typography.Title>
          <Typography.Text className="page-subtitle">
            Triggers when daily change is {DEFAULT_TRIGGER_PCT}% or worse (vs previous close).
          </Typography.Text>
        </div>

        <Card styles={{ body: { padding: 14 } }}>
          <Flex justify="space-between" align="center" wrap="wrap" gap={10}>
            <Space wrap>
              <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>
                Refresh
              </Button>
              {lastUpdatedMs ? (
                <Typography.Text type="secondary">
                  Updated {new Date(lastUpdatedMs).toLocaleString()}
                </Typography.Text>
              ) : null}
            </Space>
            {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
          </Flex>
        </Card>

        <Card styles={{ body: { padding: 0 } }}>
          <Table
            size="middle"
            loading={loading}
            dataSource={rows}
            rowKey={(r) => r.symbol}
            pagination={false}
            columns={[
              {
                title: "Status",
                dataIndex: "triggered",
                width: 110,
                render: (_: unknown, r: QuoteRow) =>
                  r.triggered ? <Tag color="red">TRIGGERED</Tag> : <Tag>OK</Tag>,
              },
              {
                title: "Symbol",
                dataIndex: "symbol",
                width: 110,
                render: (v: string) => <Typography.Text code>{v}</Typography.Text>,
              },
              {
                title: "Company",
                dataIndex: "name",
                render: (v: string, r: QuoteRow) => (
                  <Space direction="vertical" size={0}>
                    <Typography.Text>{v}</Typography.Text>
                    {r.market ? (
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {r.market}
                      </Typography.Text>
                    ) : null}
                  </Space>
                ),
              },
              {
                title: "Price",
                dataIndex: "price",
                width: 140,
                align: "right" as const,
                render: (_: unknown, r: QuoteRow) => (
                  <Space size={6}>
                    <Typography.Text>{fmtNum(r.price)}</Typography.Text>
                    {r.currency ? (
                      <Typography.Text type="secondary">{r.currency}</Typography.Text>
                    ) : null}
                  </Space>
                ),
              },
              {
                title: "% change",
                dataIndex: "changePct",
                width: 120,
                align: "right" as const,
                render: (_: unknown, r: QuoteRow) => {
                  const v = r.changePct;
                  const color = v === undefined ? undefined : v <= DEFAULT_TRIGGER_PCT ? "red" : v < 0 ? "orange" : "green";
                  return <Typography.Text type={color === "red" ? "danger" : undefined}>{fmtPct(v)}</Typography.Text>;
                },
              },
              {
                title: "Market time",
                dataIndex: "updatedAtMs",
                width: 190,
                render: (_: unknown, r: QuoteRow) =>
                  r.updatedAtMs ? new Date(r.updatedAtMs).toLocaleString() : "—",
              },
            ]}
          />
        </Card>
      </Flex>
    </div>
  );
};

export default WatchlistPage;
