import { persistAllTiers, type ClosedCandle } from "./repository";

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

  // rollover — persist closed bucket to 1m / 1h / 1d
  const closed: ClosedCandle = { ...currentBucket };
  void persistAllTiers(closed);

  // gap-fill flat candles (all tiers)
  const lastClose = closed.close;
  const gapMin = Math.floor((bucketTime.getTime() - closed.time.getTime()) / 60000) - 1;
  if (gapMin >= 1 && gapMin <= GAP_FILL_CAP) {
    for (let i = 1; i <= gapMin; i++) {
      const t = new Date(closed.time.getTime() + i * 60000);
      void persistAllTiers({
        time: t,
        open: lastClose,
        high: lastClose,
        low: lastClose,
        close: lastClose,
      });
    }
  }

  currentBucket = { time: bucketTime, open: value, high: value, low: value, close: value };
}

export function getCurrentBucket(): OHLCBucket | null {
  return currentBucket ? { ...currentBucket } : null;
}
