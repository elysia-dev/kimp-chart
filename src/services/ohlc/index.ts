import moment from "moment-timezone";
import { prisma } from "../../lib/prisma";
import {
  ingestTick as aggregatorIngestTick,
  getCurrentBucket,
  initAggregator,
} from "./aggregator";

export type CandleInterval = "1m" | "5m" | "15m" | "30m" | "1h" | "3h" | "1d";
export const VALID_INTERVALS: CandleInterval[] = ["1m", "5m", "15m", "30m", "1h", "3h", "1d"];

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

// 1m row fetch hard cap to bound memory (≈ 100k rows = ~70 days of 1m data)
const FETCH_HARD_CAP = 100_000;

function getIntervalMinutes(i: CandleInterval): number {
  switch (i) {
    case "1m":
      return 1;
    case "5m":
      return 5;
    case "15m":
      return 15;
    case "30m":
      return 30;
    case "1h":
      return 60;
    case "3h":
      return 180;
    case "1d":
      return 1440;
  }
}

function floorToKSTDay(d: Date): Date {
  return moment(d).tz("Asia/Seoul").startOf("day").toDate();
}

function floorToInterval(date: Date, intervalMinutes: number): Date {
  if (intervalMinutes >= 1440) {
    return floorToKSTDay(date);
  }
  const m = moment.utc(date).startOf("day");
  const totalMinutes = moment.utc(date).diff(m, "minutes");
  const bucketMinute = Math.floor(totalMinutes / intervalMinutes) * intervalMinutes;
  return m.add(bucketMinute, "minutes").toDate();
}

function mergeCandles(
  candles: CandleData[],
  intervalMinutes: number,
  limit: number,
): CandleData[] {
  if (candles.length === 0) return [];

  const groups = new Map<string, CandleData[]>();

  for (const c of candles) {
    const key = floorToInterval(new Date(c.time), intervalMinutes).toISOString();
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(c);
  }

  const result: CandleData[] = [];
  for (const [key, group] of groups) {
    result.push({
      time: key,
      open: group[0].open,
      high: Math.max(...group.map((g) => g.high)),
      low: Math.min(...group.map((g) => g.low)),
      close: group[group.length - 1].close,
    });
  }

  result.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  return result.slice(-limit);
}

export function ingestTick(value: number, ts: Date): void {
  aggregatorIngestTick(value, ts);
}

export async function queryCandles(
  interval: CandleInterval,
  limit = 500,
): Promise<CandleData[]> {
  const intervalMin = getIntervalMinutes(interval);

  // Need enough 1m rows to cover (limit) merged buckets, plus padding for partial first bucket
  const desiredRaw = intervalMin * limit + intervalMin;
  const fetchLimit = Math.min(Math.max(desiredRaw, 500), FETCH_HARD_CAP);

  const rows = await prisma.kimpCandle1m.findMany({
    orderBy: { time: "desc" },
    take: fetchLimit,
  });

  rows.reverse(); // chronological order

  const candles1m: CandleData[] = rows.map((r) => ({
    time: r.time.toISOString(),
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close: Number(r.close),
  }));

  // Append in-progress current bucket (not yet persisted) as the latest data point
  const current = getCurrentBucket();
  if (current) {
    const lastTime = candles1m.length > 0 ? candles1m[candles1m.length - 1].time : null;
    const currentISO = current.time.toISOString();
    if (lastTime !== currentISO) {
      candles1m.push({
        time: currentISO,
        open: current.open,
        high: current.high,
        low: current.low,
        close: current.close,
      });
    }
  }

  if (interval === "1m") return candles1m.slice(-limit);
  return mergeCandles(candles1m, intervalMin, limit);
}

export async function initOhlcState(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`;
  console.log("📊 OHLC: Postgres connected");
  await initAggregator();
}
