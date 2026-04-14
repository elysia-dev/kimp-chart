import { prisma } from "../../lib/prisma";
import { ingestTick as aggregatorIngestTick, getCurrentBucket } from "./aggregator";
import {
  queryCandles as repoQueryCandles,
  getLatest1m,
  backfillTiersFrom1m,
  type CandleInterval,
  type CandleData,
} from "./repository";

export type { CandleInterval, CandleData } from "./repository";
export const VALID_INTERVALS: CandleInterval[] = ["1m", "5m", "15m", "30m", "1h", "3h", "1d"];

export function ingestTick(value: number, ts: Date): void {
  aggregatorIngestTick(value, ts);
}

/**
 * Query candles via repository, then surface the in-progress current bucket
 * (not yet persisted) as the latest data point for sub-day intervals.
 */
export async function queryCandles(
  interval: CandleInterval,
  limit = 500,
): Promise<CandleData[]> {
  const candles = await repoQueryCandles(interval, { limit });

  // For 1m intervals, append the in-progress bucket directly if newer than DB
  if (interval === "1m") {
    const current = getCurrentBucket();
    if (current) {
      const lastTime = candles.length > 0 ? candles[candles.length - 1].time : null;
      const currentISO = current.time.toISOString();
      if (lastTime !== currentISO) {
        candles.push({
          time: currentISO,
          open: current.open,
          high: current.high,
          low: current.low,
          close: current.close,
        });
        if (candles.length > limit) candles.shift();
      }
    }
  }

  return candles;
}

export async function initOhlcState(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
  console.log("📊 OHLC: Postgres connected");
  const last = await getLatest1m();
  if (last) {
    console.log(`📊 OHLC: last persisted 1m candle at ${last.time.toISOString()}`);
    const { scanned } = await backfillTiersFrom1m();
    console.log(`📊 OHLC: backfilled 1h/1d tiers from ${scanned} 1m rows`);
  } else {
    console.log("📊 OHLC: no prior candles in DB (cold start)");
  }
}
