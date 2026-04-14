import {
  createChart,
  CrosshairMode,
  CandlestickSeries,
  IChartApi,
  ISeriesApi,
} from "lightweight-charts";

interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

function toKSTTimestamp(iso: string): number {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)!.value);
  return Math.floor(
    Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second")) /
      1000,
  );
}

const CHART_OPTIONS = {
  layout: {
    background: { type: "solid" as const, color: "#16213e" },
    textColor: "#DDD",
  },
  grid: {
    vertLines: { color: "#2B2B43" },
    horzLines: { color: "#2B2B43" },
  },
  crosshair: {
    mode: CrosshairMode.Normal,
  },
  rightPriceScale: {
    borderColor: "#2B2B43",
  },
  timeScale: {
    borderColor: "#2B2B43",
    timeVisible: true,
    secondsVisible: false,
  },
};

class KimpCandleChart {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<"Candlestick"> | null = null;
  private container: HTMLElement;
  private infoPanel: HTMLElement;
  private currentTimeframe: string = "5m";
  private pollHandle: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.container = document.getElementById("chart")!;
    this.infoPanel = document.getElementById("info-panel")!;
  }

  async init(): Promise<void> {
    try {
      this.hideLoading();
      this.createChart();
      this.setupTimeframeButtons();
      await this.loadData();
      this.setupCrosshairHandler();
      this.setupResizeHandler();
      this.startPolling();
    } catch (error) {
      this.showError(error as Error);
    }
  }

  private createChart(): void {
    this.chart = createChart(this.container, {
      ...CHART_OPTIONS,
      width: this.container.clientWidth,
      height: 500,
    });

    this.series = this.chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
  }

  private setupTimeframeButtons(): void {
    const buttons = document.querySelectorAll("[data-tf]");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tf = (btn as HTMLElement).dataset.tf!;
        if (tf === this.currentTimeframe) return;

        buttons.forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        this.currentTimeframe = tf;
        this.loadData();
      });
    });
  }

  private async loadData(): Promise<void> {
    try {
      const interval = this.currentTimeframe;
      const res = await fetch(`/api/candles?interval=${interval}&limit=500`);
      const json = await res.json();

      if (!json.success || !json.candles || json.candles.length === 0) {
        this.showEmpty();
        return;
      }

      const candles: CandleData[] = json.candles;
      const isDaily = interval === "1d";

      const chartData = candles.map((c) => {
        const time = isDaily ? c.time.split("T")[0] : toKSTTimestamp(c.time);
        return { time: time as any, open: c.open, high: c.high, low: c.low, close: c.close };
      });

      this.series!.setData(chartData as any);
      this.chart!.timeScale().fitContent();
      this.updateInfoPanel(candles);
    } catch (error) {
      console.error("Failed to load candle data:", error);
    }
  }

  private showEmpty(): void {
    this.series!.setData([]);
    this.infoPanel.innerHTML = `
      <div class="info-item">
        <span class="info-label">No candle data yet — waiting for first poll...</span>
      </div>
    `;
  }

  private hideLoading(): void {
    document.getElementById("loading")!.style.display = "none";
    document.getElementById("chart-container")!.style.display = "block";
  }

  private showError(error: Error): void {
    console.error("Error loading candle chart:", error);
    document.getElementById("loading")!.textContent = `Error: ${error.message}`;
  }

  private setupCrosshairHandler(): void {
    this.chart!.subscribeCrosshairMove((param) => {
      if (!param.time || !this.series) return;

      const data = param.seriesData.get(this.series as ISeriesApi<"Candlestick">);
      if (data && "open" in data) {
        const d = data as { open: number; high: number; low: number; close: number };
        const change = d.close - d.open;
        const changePct = d.open !== 0 ? ((change / d.open) * 100).toFixed(2) : "0.00";
        const color = change >= 0 ? "#22c55e" : "#ef4444";

        this.infoPanel.innerHTML = `
          <div class="info-item">
            <span class="info-label">O:</span>
            <span class="info-value">${d.open.toFixed(4)}%</span>
          </div>
          <div class="info-item">
            <span class="info-label">H:</span>
            <span class="info-value">${d.high.toFixed(4)}%</span>
          </div>
          <div class="info-item">
            <span class="info-label">L:</span>
            <span class="info-value">${d.low.toFixed(4)}%</span>
          </div>
          <div class="info-item">
            <span class="info-label">C:</span>
            <span class="info-value">${d.close.toFixed(4)}%</span>
          </div>
          <div class="info-item">
            <span class="info-label">Change:</span>
            <span class="info-value" style="color: ${color};">${change >= 0 ? "+" : ""}${changePct}%</span>
          </div>
        `;
      }
    });
  }

  private updateInfoPanel(candles: CandleData[]): void {
    if (candles.length === 0) return;
    const last = candles[candles.length - 1];
    const change = last.close - last.open;
    const changePct = last.open !== 0 ? ((change / last.open) * 100).toFixed(2) : "0.00";
    const color = change >= 0 ? "#22c55e" : "#ef4444";

    this.infoPanel.innerHTML = `
      <div class="info-item">
        <span class="info-label">Latest:</span>
        <span class="info-value">${last.close.toFixed(4)}%</span>
      </div>
      <div class="info-item">
        <span class="info-label">O:</span>
        <span class="info-value">${last.open.toFixed(4)}%</span>
      </div>
      <div class="info-item">
        <span class="info-label">H:</span>
        <span class="info-value">${last.high.toFixed(4)}%</span>
      </div>
      <div class="info-item">
        <span class="info-label">L:</span>
        <span class="info-value">${last.low.toFixed(4)}%</span>
      </div>
      <div class="info-item">
        <span class="info-label">C:</span>
        <span class="info-value">${last.close.toFixed(4)}%</span>
      </div>
      <div class="info-item">
        <span class="info-label">Change:</span>
        <span class="info-value" style="color: ${color};">${change >= 0 ? "+" : ""}${changePct}%</span>
      </div>
      <div class="info-item">
        <span class="info-label">TF:</span>
        <span class="info-value">${this.currentTimeframe}</span>
      </div>
    `;
  }

  private setupResizeHandler(): void {
    window.addEventListener("resize", () => {
      this.chart?.applyOptions({ width: this.container.clientWidth });
    });
  }

  private startPolling(): void {
    this.pollHandle = setInterval(() => this.loadData().catch((e) => console.error("poll failed", e)), 5000);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const chart = new KimpCandleChart();
  chart.init();
});
