import { fetchUpbitUsdtMid } from "./upbit";
import { fetchSwitchOneUsdKrw } from "./switchone";
import { ingestTick } from "../ohlc";
import { getKp } from "../../utils/kimp";

const POLLING_INTERVAL_MS = parseInt(process.env.POLLING_INTERVAL || "5000");
const DEBUG_PAUSE_POLLER = process.env.DEBUG_PAUSE_POLLER === "1";

async function poll(): Promise<void> {
  if (DEBUG_PAUSE_POLLER) {
    console.log("poller paused");
    return;
  }

  const [usdtMid, usdKrw] = await Promise.all([fetchUpbitUsdtMid(), fetchSwitchOneUsdKrw()]);

  if (usdtMid !== null && usdKrw !== null) {
    const kimp = getKp({ usdt: usdtMid, usdKrw });
    const now = new Date();
    ingestTick(kimp, now);
    console.log(`[${now.toISOString()}] kimp: ${kimp.toFixed(4)}%`);
  } else {
    if (usdtMid === null) console.warn("upbit fetch returned null");
    if (usdKrw === null) console.warn("switchone fetch returned null");
  }
}

export function startPricePoller(): ReturnType<typeof setInterval> {
  async function safePoll(): Promise<void> {
    try {
      await poll();
    } catch (e: any) {
      console.error("poll error:", e.message);
    }
  }

  safePoll();
  return setInterval(safePoll, POLLING_INTERVAL_MS);
}

export function stopPricePoller(handle: ReturnType<typeof setInterval>): void {
  clearInterval(handle);
}
