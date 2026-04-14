import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import axios from "axios";

const SWITCHONE_HOST = process.env.SWITCHONE_HOST || "https://api.switchwon.com";
const SWITCHONE_CLIENT_ID = process.env.SWITCHONE_CLIENT_ID || "";
const SWITCHONE_SECRET_KEY = process.env.SWITCHONE_SECRET_KEY || "";

interface SwitchOneExchangeRateResponse {
  code: string;
  message: string;
  traceId: string;
  returnObject: {
    applyDate: string;
    applyTime: string;
    currency: string;
    noticeSeq: number;
    tradeStanRate: number;
    userSellRate: number;
    userBuyRate: number;
    usExRate: number;
    exchangeRateUnit: number;
    previousTradeStanRate: number;
    previousContrast: number;
    previousRange: number;
  };
}

function createAuthToken(): string {
  const payload = {
    client_id: SWITCHONE_CLIENT_ID,
    nonce: uuidv4(),
  };
  const token = jwt.sign(payload, SWITCHONE_SECRET_KEY, { algorithm: "HS256" });
  return `Bearer ${token}`;
}

export async function fetchSwitchOneUsdKrw(): Promise<number | null> {
  if (!SWITCHONE_CLIENT_ID || !SWITCHONE_SECRET_KEY) {
    console.warn("SwitchOne API credentials not configured, skipping");
    return null;
  }

  try {
    const authToken = createAuthToken();

    const response = await axios.get<SwitchOneExchangeRateResponse>(
      `${SWITCHONE_HOST}/open-api/exchange-rate/latest/USDX`,
      {
        headers: {
          Authorization: authToken,
          "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        },
        timeout: 5000,
      },
    );

    const { code, returnObject } = response.data;

    if (code !== "00" || !returnObject) {
      console.error("SwitchOne API error:", response.data.message);
      return null;
    }

    return returnObject.tradeStanRate;
  } catch (error: any) {
    if (error.response) {
      console.error(`SwitchOne API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    } else {
      console.error(`SwitchOne API error: ${error.message}`);
    }
    return null;
  }
}
