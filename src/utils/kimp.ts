export function getKp({ usdt, usdKrw }: { usdt: number; usdKrw: number }): number {
  return ((usdt - usdKrw) / usdKrw) * 100;
}
