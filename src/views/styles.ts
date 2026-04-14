export const chartStyles = `
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1a1a2e;
  color: #eee;
  padding: 20px;
}

h1 {
  text-align: center;
  margin-bottom: 20px;
  color: #00d4aa;
}

.chart-container {
  max-width: 1400px;
  margin: 0 auto;
}

.chart-wrapper {
  background: #16213e;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
}

.chart {
  width: 100%;
  height: 500px;
}

.loading {
  text-align: center;
  padding: 100px;
  color: #888;
}

.info-panel {
  display: flex;
  gap: 24px;
  margin-top: 12px;
  padding: 12px;
  background: #0f172a;
  border-radius: 8px;
  font-size: 13px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.info-label {
  color: #888;
}

.info-value {
  font-weight: 600;
}

.controls-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
  padding: 12px;
  background: #0f172a;
  border-radius: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.control-group {
  display: flex;
  gap: 8px;
  align-items: center;
}

.control-label {
  font-size: 12px;
  color: #888;
  font-weight: 500;
}

.ctrl-btn {
  padding: 8px 16px;
  border: 1px solid #2B2B43;
  border-radius: 6px;
  background: transparent;
  color: #888;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.ctrl-btn:hover {
  border-color: #00d4aa;
  color: #ddd;
}

.ctrl-btn.active {
  background: #00d4aa;
  border-color: #00d4aa;
  color: #1a1a2e;
}
`;
