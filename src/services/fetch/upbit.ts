import axios from "axios";

export async function fetchUpbitUsdtMid(): Promise<number | null> {
  try {
    const res = await axios.get("https://api.upbit.com/v1/orderbook?markets=KRW-USDT", { timeout: 5000 });
    const units = res.data[0]?.orderbook_units;
    if (!units || units.length === 0) return null;
    return (units[0].bid_price + units[0].ask_price) / 2;
  } catch (e: any) {
    console.error("upbit fetch failed:", e.message);
    return null;
  }
}
