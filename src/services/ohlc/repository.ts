import moment from "moment-timezone";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma";

export type CandleInterval = "1m" | "5m" | "15m" | "30m" | "1h" | "3h" | "1d";

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface ClosedCandle {
  time: Date;
  open: number;
  high: number;
  low: number;
  close: number;
}

type SourceTable = "1m" | "1h" | "1d";

function getSourceTable(interval: CandleInterval): SourceTable {
  switch (interval) {
    case "1m":
    case "5m":
    case "15m":
    case "30m":
      return "1m";
    case "1h":
    case "3h":
      return "1h";
    case "1d":
      return "1d";
  }
}

function getIntervalMinutes(interval: CandleInterval): number {
  switch (interval) {
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

function needsMerge(interval: CandleInterval): boolean {
  return interval !== "1m" && interval !== "1h" && interval !== "1d";
}

function toDecimal(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n.toFixed(4));
}

function floorToHour(date: Date): Date {
  return moment.utc(date).startOf("hour").toDate();
}

function floorToKSTDay(date: Date): Date {
  return moment(date).tz("Asia/Seoul").startOf("day").toDate();
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

// === Upserts ===

/** 1m candle — overwrite */
export async function upsert1m(c: ClosedCandle): Promise<void> {
  await prisma.kimpCandle1m.upsert({
    where: { time: c.time },
    update: {
      open: toDecimal(c.open),
      high: toDecimal(c.high),
      low: toDecimal(c.low),
      close: toDecimal(c.close),
    },
    create: {
      time: c.time,
      open: toDecimal(c.open),
      high: toDecimal(c.high),
      low: toDecimal(c.low),
      close: toDecimal(c.close),
    },
  });
}

/** 1h candle — additive upsert (GREATEST/LEAST) */
export async function upsert1h(c: ClosedCandle): Promise<void> {
  const hourTime = floorToHour(c.time);
  await prisma.$executeRaw`
    INSERT INTO kimp_candle_1h (time, open, high, low, close)
    VALUES (${hourTime}, ${toDecimal(c.open)}, ${toDecimal(c.high)}, ${toDecimal(c.low)}, ${toDecimal(c.close)})
    ON CONFLICT (time)
    DO UPDATE SET
      high = GREATEST(kimp_candle_1h.high, EXCLUDED.high),
      low = LEAST(kimp_candle_1h.low, EXCLUDED.low),
      close = EXCLUDED.close
  `;
}

/** 1d candle — additive upsert, KST day boundary */
export async function upsert1d(c: ClosedCandle): Promise<void> {
  const dayTime = floorToKSTDay(c.time);
  await prisma.$executeRaw`
    INSERT INTO kimp_candle_1d (time, open, high, low, close)
    VALUES (${dayTime}, ${toDecimal(c.open)}, ${toDecimal(c.high)}, ${toDecimal(c.low)}, ${toDecimal(c.close)})
    ON CONFLICT (time)
    DO UPDATE SET
      high = GREATEST(kimp_candle_1d.high, EXCLUDED.high),
      low = LEAST(kimp_candle_1d.low, EXCLUDED.low),
      close = EXCLUDED.close
  `;
}

/**
 * Persist a closed candle into all three tiers (1m / 1h / 1d).
 * Each tier is independent; failures are isolated.
 */
export async function persistAllTiers(c: ClosedCandle): Promise<void> {
  try {
    await upsert1m(c);
  } catch (e: any) {
    console.error(`❌ upsert1m ${c.time.toISOString()} failed:`, e.message);
  }
  try {
    await upsert1h(c);
  } catch (e: any) {
    console.error(`❌ upsert1h ${c.time.toISOString()} failed:`, e.message);
  }
  try {
    await upsert1d(c);
  } catch (e: any) {
    console.error(`❌ upsert1d ${c.time.toISOString()} failed:`, e.message);
  }
}

// === Query ===

interface QueryOptions {
  limit?: number;
}

export async function queryCandles(
  interval: CandleInterval,
  options: QueryOptions = {},
): Promise<CandleData[]> {
  const limit = options.limit ?? 500;
  const sourceTable = getSourceTable(interval);

  const raw = await fetchFromTable(sourceTable, limit, interval);
  if (raw.length === 0) return [];

  if (!needsMerge(interval)) return raw;

  const minutes = getIntervalMinutes(interval);
  return mergeCandles(raw, minutes, limit);
}

async function fetchFromTable(
  table: SourceTable,
  limit: number,
  interval: CandleInterval,
): Promise<CandleData[]> {
  const sourceMinutes = table === "1m" ? 1 : table === "1h" ? 60 : 1440;
  const targetMinutes = getIntervalMinutes(interval);
  const multiplier = targetMinutes / sourceMinutes;
  const fetchLimit = limit * multiplier + multiplier;

  let rows: {
    time: Date;
    open: Prisma.Decimal;
    high: Prisma.Decimal;
    low: Prisma.Decimal;
    close: Prisma.Decimal;
  }[];

  switch (table) {
    case "1m":
      rows = await prisma.kimpCandle1m.findMany({
        orderBy: { time: "desc" },
        take: fetchLimit,
        select: { time: true, open: true, high: true, low: true, close: true },
      });
      break;
    case "1h":
      rows = await prisma.kimpCandle1h.findMany({
        orderBy: { time: "desc" },
        take: fetchLimit,
        select: { time: true, open: true, high: true, low: true, close: true },
      });
      break;
    case "1d":
      rows = await prisma.kimpCandle1d.findMany({
        orderBy: { time: "desc" },
        take: fetchLimit,
        select: { time: true, open: true, high: true, low: true, close: true },
      });
      break;
  }

  rows.reverse();

  return rows.map((r) => ({
    time: r.time.toISOString(),
    open: Number(r.open),
    high: Number(r.high),
    low: Number(r.low),
    close: Number(r.close),
  }));
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

/** Latest 1m candle (used to surface the in-progress bucket gap on read) */
export async function getLatest1m(): Promise<{ time: Date; close: number } | null> {
  const row = await prisma.kimpCandle1m.findFirst({
    orderBy: { time: "desc" },
    select: { time: true, close: true },
  });
  if (!row) return null;
  return { time: row.time, close: Number(row.close) };
}

/**
 * Rebuild 1h and 1d aggregates from the kimp_candle_1m table.
 * Idempotent: relies on additive upsert (GREATEST/LEAST/EXCLUDED.close).
 * Safe to run on every startup; cheap when fully synced.
 */
export async function backfillTiersFrom1m(): Promise<{ scanned: number }> {
  const rows = await prisma.kimpCandle1m.findMany({
    orderBy: { time: "asc" },
    select: { time: true, open: true, high: true, low: true, close: true },
  });
  for (const r of rows) {
    const c: ClosedCandle = {
      time: r.time,
      open: Number(r.open),
      high: Number(r.high),
      low: Number(r.low),
      close: Number(r.close),
    };
    try {
      await upsert1h(c);
    } catch (e: any) {
      console.error(`backfill 1h ${r.time.toISOString()} failed:`, e.message);
    }
    try {
      await upsert1d(c);
    } catch (e: any) {
      console.error(`backfill 1d ${r.time.toISOString()} failed:`, e.message);
    }
  }
  return { scanned: rows.length };
}
