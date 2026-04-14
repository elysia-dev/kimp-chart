import "dotenv/config";
import fs from "fs";
import path from "path";
import moment from "moment-timezone";
import { prisma } from "../src/lib/prisma";

async function main(): Promise<void> {
  // 어제 KST 자정 — kimp_candle_1d의 time PK
  const yesterdayKST = moment().tz("Asia/Seoul").subtract(1, "day").startOf("day").toDate();
  const dateStr = moment(yesterdayKST).tz("Asia/Seoul").format("YYYY-MM-DD");

  const candle = await prisma.kimpCandle1d.findUnique({ where: { time: yesterdayKST } });
  if (!candle) {
    console.error(`❌ No 1d candle for ${dateStr} (looking for ${yesterdayKST.toISOString()})`);
    process.exit(1);
  }

  const open = Number(candle.open).toFixed(4);
  const high = Number(candle.high).toFixed(4);
  const low = Number(candle.low).toFixed(4);
  const close = Number(candle.close).toFixed(4);

  const line = `${dateStr}\topen=${open}\thigh=${high}\tlow=${low}\tclose=${close}\n`;
  const filePath = path.resolve(__dirname, "..", "daily-close.txt");

  // 같은 날짜가 이미 기록되어 있으면 skip (idempotent)
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
  if (existing.includes(`${dateStr}\t`)) {
    console.log(`⏭️  ${dateStr} already recorded; skipping`);
    return;
  }

  fs.appendFileSync(filePath, line);
  console.log(`✅ Appended: ${line.trim()}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
