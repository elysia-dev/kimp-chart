import express from "express";
import path from "path";
import { queryCandles, VALID_INTERVALS, type CandleInterval } from "./services/ohlc";
import { getCandleHtml } from "./views/candle";

const app = express();
app.use(express.json());
app.use("/static", express.static(path.join(__dirname, "../public")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/candle", (_req, res) => {
  res.send(getCandleHtml());
});

app.get("/api/candles", async (req, res) => {
  const interval = (req.query.interval as string) ?? "5m";
  if (!VALID_INTERVALS.includes(interval as CandleInterval)) {
    res.status(400).json({ success: false, error: "Invalid interval" });
    return;
  }
  const rawLimit = parseInt((req.query.limit as string) ?? "500", 10);
  const limit = Math.min(1440, Math.max(1, isNaN(rawLimit) ? 500 : rawLimit));
  try {
    const candles = await queryCandles(interval as CandleInterval, limit);
    res.json({ success: true, candles });
  } catch (e: any) {
    console.error("queryCandles failed:", e.message);
    res.status(500).json({ success: false, error: e.message });
  }
});

export function startServer() {
  const port = parseInt(process.env.PORT ?? "3000", 10);
  app.listen(port, () => {
    console.log(`Server listening on :${port}`);
    console.log(`Visit http://localhost:${port}/candle`);
  });
}
