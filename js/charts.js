import { ASSET_PALETTE } from "./config.js";
import { fmtBRL, fmtBRLCompact } from "./utils.js";

/* global Chart */

const COLORS = {
  text: "#E8E8F0",
  muted: "#6A6A82",
  grid: "#1E1E30",
  cost: "#3A3A52",
  current: "#C41E3A",
  tooltipBg: "#1A1A28",
};

let pieChart = null;
let barChart = null;

const hasChartJS = () => typeof window.Chart !== "undefined";

function applyDefaults() {
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.color = COLORS.muted;
  Object.assign(Chart.defaults.plugins.tooltip, {
    backgroundColor: COLORS.tooltipBg,
    borderColor: COLORS.grid,
    borderWidth: 1,
    titleColor: COLORS.text,
    bodyColor: COLORS.text,
    padding: 10,
    cornerRadius: 6,
    boxPadding: 4,
  });
}

function setEmpty(canvas, isEmpty) {
  canvas.parentElement.classList.toggle("is-empty", isEmpty);
}

function createPie(canvas) {
  return new Chart(canvas, {
    type: "doughnut",
    data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 0, hoverOffset: 6 }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "68%",
      plugins: {
        legend: {
          position: "right",
          labels: { color: COLORS.text, boxWidth: 10, boxHeight: 10, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label(ctx) {
              const total = ctx.dataset.data.reduce((s, v) => s + v, 0);
              const pct = total ? (ctx.parsed / total) * 100 : 0;
              return ` ${fmtBRL(ctx.parsed)} (${pct.toFixed(1).replace(".", ",")}%)`;
            },
          },
        },
      },
    },
  });
}

function createBar(canvas) {
  return new Chart(canvas, {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        { label: "Investido", data: [], backgroundColor: COLORS.cost, borderRadius: 3 },
        { label: "Atual", data: [], backgroundColor: COLORS.current, borderRadius: 3 },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { color: COLORS.muted } },
        y: {
          grid: { color: COLORS.grid },
          border: { display: false },
          ticks: { color: COLORS.muted, callback: (v) => fmtBRLCompact(v) },
        },
      },
      plugins: {
        legend: { labels: { color: COLORS.text, boxWidth: 10, boxHeight: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${fmtBRL(ctx.parsed.y)}` } },
      },
    },
  });
}

export function updateCharts(positions) {
  const pieCanvas = document.getElementById("chartPie");
  const barCanvas = document.getElementById("chartBar");
  const isEmpty = positions.length === 0;

  setEmpty(pieCanvas, isEmpty);
  setEmpty(barCanvas, isEmpty);
  if (!hasChartJS()) return;

  if (!pieChart) {
    applyDefaults();
    pieChart = createPie(pieCanvas);
    barChart = createBar(barCanvas);
  }

  const labels = positions.map((p) => p.ticker);

  pieChart.data.labels = labels;
  pieChart.data.datasets[0].data = positions.map((p) => p.posValue);
  pieChart.data.datasets[0].backgroundColor = positions.map((p) => p.color);
  pieChart.options.plugins.legend.position = window.innerWidth < 520 ? "bottom" : "right";
  pieChart.update();

  barChart.data.labels = labels;
  barChart.data.datasets[0].data = positions.map((p) => p.costBasis);
  barChart.data.datasets[1].data = positions.map((p) => p.posValue);
  barChart.update();
}

/** Cor estável por ativo, baseada na ordem de cadastro. */
export const colorForIndex = (i) => ASSET_PALETTE[i % ASSET_PALETTE.length];
