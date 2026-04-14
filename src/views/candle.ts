import { chartStyles } from "./styles";

export function getCandleHtml(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kimp Candle Chart</title>
  <style>
${chartStyles}
  </style>
</head>
<body>
  <h1>Kimp Candle Chart (SwitchOne × Upbit)</h1>

  <div id="loading" class="loading">Loading candle data...</div>

  <div id="chart-container" class="chart-container" style="display: none;">
    <div class="chart-wrapper">
      <div class="controls-bar">
        <div class="control-group">
          <span class="control-label">Timeframe:</span>
          <button class="ctrl-btn" data-tf="1m">1m</button>
          <button class="ctrl-btn active" data-tf="5m">5m</button>
          <button class="ctrl-btn" data-tf="15m">15m</button>
          <button class="ctrl-btn" data-tf="30m">30m</button>
          <button class="ctrl-btn" data-tf="1h">1h</button>
          <button class="ctrl-btn" data-tf="3h">3h</button>
          <button class="ctrl-btn" data-tf="1d">1D</button>
        </div>
      </div>
      <div id="chart" class="chart"></div>
      <div class="info-panel" id="info-panel"></div>
    </div>
  </div>

  <script src="/static/candle.js"></script>
</body>
</html>`;
}
