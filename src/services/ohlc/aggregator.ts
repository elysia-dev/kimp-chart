import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export interface OHLCBucket {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

let currentBucket: OHLCBucket | null = null;

const GAP_FILL_CAP = 1440;

function floorToMinute(d: Date): Date {
  const x = new Date(d);
  x.setUTCSeconds(0, 0);
  return x;
}

function toDecimal(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(4));
}

async function persistCandle(b: OHLCBucket): Promise<void> {
  try {
    await prisma.kimpCandle1m.upsert({
      where: { time: b.time },
      update: {
        open: toDecimal(b.open),
        high: toDecimal(b.high),
        low: toDecimal(b.low),
        close: toDecimal(b.close),
      },
      create: {
        time: b.time,
        open: toDecimal(b.open),
        high: toDecimal(b.high),
        low: toDecimal(b.low),
        close: toDecimal(b.close),
      },
    });
  } catch (e: any) {
    console.error(`❌ persist candle ${b.time.toISOString()} failed:`, e.message);
  }
}

export function ingestTick(value: number, ts: Date): void {
  const bucketTime = floorToMinute(ts);

  if (currentBucket === null) {
    currentBucket = { time: bucketTime, open: value, high: value, low: value, close: value };
    return;
  }

  if (bucketTime.getTime() < currentBucket.time.getTime()) {
    return; // NTP skew defense
  }

  if (bucketTime.getTime() === currentBucket.time.getTime()) {
    currentBucket.high = Math.max(currentBucket.high, value);
    currentBucket.low = Math.min(currentBucket.low, value);
    currentBucket.close = value;
    return;
  }

  // rollover — persist closed bucket (fire & forget)
  const closed: OHLCBucket = { ...currentBucket };
  void persistCandle(closed);

  // gap-fill flat candles
  const lastClose = closed.close;
  const gapMin = Math.floor((bucketTime.getTime() - closed.time.getTime()) / 60000) - 1;
  if (gapMin >= 1 && gapMin <= GAP_FILL_CAP) {
    for (let i = 1; i <= gapMin; i++) {
      const t = new Date(closed.time.getTime() + i * 60000);
      void persistCandle({ time: t, open: lastClose, high: lastClose, low: lastClose, close: lastClose });
    }
  }

  currentBucket = { time: bucketTime, open: value, high: value, low: value, close: value };
}

export function getCurrentBucket(): OHLCBucket | null {
  return currentBucket ? { ...currentBucket } : null;
}

/**
 * On startup, persist whatever current bucket existed before restart? No —
 * currentBucket is always null on cold start. This function is a hook for the
 * server to verify DB connectivity and to restore the last known bucket time
 * if needed in the future.
 */
export async function initAggregator(): Promise<void> {
  const last = await prisma.kimpCandle1m.findFirst({ orderBy: { time: "desc" } });
  if (last) {
    console.log(`📊 Aggregator: last persisted candle at ${last.time.toISOString()}`);
  } else {
    console.log("📊 Aggregator: no prior candles in DB (cold start)");
  }
}
