import type { DydxCandle, Timeframe } from "@/shared/types/trading";

/**
 * Lightweight real-time candle stream utility.
 * - Primary: OKX public WebSocket (documented), channel: candle{BAR}, instId: BTC-USDT
 * - You can later switch to the backend dYdX WS proxy once channel schema is confirmed.
 *
 * Usage:
 *   const stop = startCandleStream("BTC-USD", "1h", (candle, type) => { ... });
 *   // call stop() to close the stream
 */
function mapToOkxInst(symbol: string): string {
  const upper = symbol.toUpperCase();
  // map -USD -> -USDT for OKX pairs
  if (upper.endsWith("-USD")) return upper.replace("-USD", "-USDT");
  return upper;
}

function mapToOkxBar(tf: Timeframe): string {
  switch (tf) {
    case "1m":
    case "5m":
    case "15m":
    case "30m":
      return tf;
    case "1h":
      return "1H";
    case "4h":
      return "4H";
    case "1d":
      return "1D";
    default:
      return "1H";
  }
}

/**
 * Start an OKX candle WebSocket stream and invoke onCandle for each update.
 * OKX sends arrays: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
 * confirm: "0" (partial) or "1" (final close of candle)
 */
export function startCandleStream(
  symbol: string,
  tf: Timeframe,
  onCandle: (candle: DydxCandle, type: "partial" | "final") => void
): () => void {
  const instId = mapToOkxInst(symbol);
  const bar = mapToOkxBar(tf);

  const ws = new WebSocket("wss://ws.okx.com:8443/ws/v5/public");

  const subMsg = {
    op: "subscribe",
    args: [{ channel: `candle${bar}`, instId }],
  };

  const handleMessage = (ev: MessageEvent) => {
    try {
      const msg = JSON.parse(typeof ev.data === "string" ? ev.data : "");
      if (!msg || !msg.data || !Array.isArray(msg.data)) return;

      for (const k of msg.data) {
        // k: [ts, o, h, l, c, vol, volCcy, volCcyQuote, confirm]
        const ts = Number(k[0]);
        const open = parseFloat(k[1]);
        const high = parseFloat(k[2]);
        const low = parseFloat(k[3]);
        const close = parseFloat(k[4]);
        const volume = k[5] !== undefined ? parseFloat(k[5]) : undefined;
        const confirm = String(k[8] ?? "0");
        const type = confirm === "1" ? "final" : "partial";
        const candle: DydxCandle = {
          time: ts,
          open,
          high,
          low,
          close,
          volume,
          timeframe: tf,
          symbol,
        };
        onCandle(candle, type);
      }
    } catch {
      // ignore parse errors
    }
  };

  const handleOpen = () => {
    ws.send(JSON.stringify(subMsg));
    // ping to keep alive
    const ping = JSON.stringify({ op: "ping" });
    const interval = setInterval(() => {
      try {
        ws.readyState === WebSocket.OPEN && ws.send(ping);
      } catch {}
    }, 20_000);
    // attach interval handle on ws for cleanup
    (ws as any).__ping = interval;
  };

  const handleClose = () => {
    try {
      const i = (ws as any).__ping;
      if (i) clearInterval(i);
    } catch {}
  };

  ws.addEventListener("open", handleOpen);
  ws.addEventListener("message", handleMessage);
  ws.addEventListener("close", handleClose);
  ws.addEventListener("error", handleClose);

  // stop function
  return () => {
    try {
      ws.removeEventListener("open", handleOpen);
      ws.removeEventListener("message", handleMessage);
      ws.removeEventListener("close", handleClose);
      ws.removeEventListener("error", handleClose);
      try {
        const i = (ws as any).__ping;
        if (i) clearInterval(i);
      } catch {}
      ws.close();
    } catch {}
  };
}
