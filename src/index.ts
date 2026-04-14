import "dotenv/config";
import moment from "moment-timezone";
moment.tz.setDefault("Asia/Seoul");
import { startServer } from "./server";
import { startPricePoller } from "./services/fetch/pricePoller";
import { initOhlcState } from "./services/ohlc";

async function main() {
  console.log("🚀 Kimp Chart Only — starting...");
  await initOhlcState();
  startServer();
  await startPricePoller();
}
main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
