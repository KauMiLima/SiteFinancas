import { CONFIG } from "./config.js";
import { fetchAvailableTickers, fetchQuotes } from "./api.js";
import { loadPortfolio, savePortfolio, sanitizeAsset, loadPreference, savePreference } from "./storage.js";
import {
  addOrMergeAsset,
  changeQuantity,
  consolidateAssets,
  computePortfolio,
  getMarketStatus,
  removeAsset,
  sortPositions,
} from "./portfolio.js";
import { colorForIndex, updateCharts } from "./charts.js";
import {
  renderAllocBars,
  renderLastUpdate,
  renderMarketStatus,
  renderSortIndicators,
  renderSummary,
  renderTable,
  renderTicker,
  setRefreshing,
  showToast,
} from "./render.js";
import { initModal, setTickerSuggestions } from "./modal.js";
import { debounce } from "./utils.js";

const initialAssets = loadPortfolio();
const consolidated = consolidateAssets(initialAssets);
if (consolidated.length !== initialAssets.length) savePortfolio(consolidated);

const state = {
  assets: consolidated,
  sort: loadPreference(CONFIG.STORAGE_KEYS.sort, { key: "posValue", dir: "desc" }),
  refreshing: false,
};

function commit(nextAssets) {
  state.assets = nextAssets;
  savePortfolio(state.assets);
  render();
}

function render() {
  const portfolio = computePortfolio(state.assets);
  // Cor fixa por ordem de cadastro, para não mudar ao reordenar a tabela.
  const colored = portfolio.positions.map((p, i) => ({ ...p, color: colorForIndex(i) }));
  const sorted = sortPositions(colored, state.sort);

  renderSummary(portfolio, state.assets.length);
  renderAllocBars(portfolio);
  renderTable(sorted);
  renderSortIndicators(state.sort);
  renderTicker(colored);
  updateCharts(colored);
}

async function refreshQuotes({ force = false } = {}) {
  if (state.refreshing || !state.assets.length) return;
  state.refreshing = true;
  setRefreshing(true);

  const tickers = state.assets.map((a) => a.ticker);
  const failures = await fetchQuotes(tickers, {
    force,
    onQuote(ticker, quote) {
      state.assets = state.assets.map((a) =>
        a.ticker === ticker
          ? { ...a, currentPrice: quote.price, changePct: quote.changePct, name: quote.name || a.name }
          : a
      );
      savePortfolio(state.assets);
      render();
    },
  });

  state.refreshing = false;
  setRefreshing(false);
  renderLastUpdate(new Date(), failures);
  if (failures && force) {
    showToast(`Não foi possível atualizar ${failures} de ${tickers.length} cotações.`);
  }
}

function handleTableClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = button.closest("tr")?.dataset.id;
  if (!id) return;

  const { action } = button.dataset;
  if (action === "inc") commit(changeQuantity(state.assets, id, 1));
  if (action === "dec") commit(changeQuantity(state.assets, id, -1));
  if (action === "remove") {
    const snapshot = state.assets;
    const asset = snapshot.find((a) => a.id === id);
    commit(removeAsset(state.assets, id));
    showToast(`${asset.ticker} removido da carteira.`, {
      actionLabel: "Desfazer",
      onAction: () => commit(snapshot),
    });
  }
}

function handleSortClick(event) {
  const th = event.target.closest("th[data-sort]");
  if (!th) return;
  const key = th.dataset.sort;
  const dir = state.sort.key === key && state.sort.dir === "desc" ? "asc" : "desc";
  state.sort = { key, dir: key === "ticker" && state.sort.key !== key ? "asc" : dir };
  savePreference(CONFIG.STORAGE_KEYS.sort, state.sort);
  render();
}

function exportPortfolio() {
  if (!state.assets.length) {
    showToast("A carteira está vazia — nada para exportar.");
    return;
  }
  const blob = new Blob([JSON.stringify(state.assets, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = Object.assign(document.createElement("a"), {
    href: url,
    download: `carteira-b3-${new Date().toISOString().slice(0, 10)}.json`,
  });
  link.click();
  URL.revokeObjectURL(url);
}

async function importPortfolio(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    const imported = (Array.isArray(data) ? data : []).map(sanitizeAsset).filter(Boolean);
    if (!imported.length) throw new Error("vazio");

    const snapshot = state.assets;
    const merged = consolidateAssets([...state.assets, ...imported]);
    commit(merged);
    showToast(`${imported.length} ativo(s) importado(s).`, {
      variant: "success",
      actionLabel: "Desfazer",
      onAction: () => commit(snapshot),
    });
    refreshQuotes();
  } catch {
    showToast("Arquivo inválido. Use um JSON exportado por este app.");
  }
}

function init() {
  initModal({
    onSubmit(asset) {
      const { assets, merged } = addOrMergeAsset(state.assets, asset);
      commit(assets);
      showToast(
        merged ? `${asset.ticker}: cotas somadas e preço médio recalculado.` : `${asset.ticker} adicionado à carteira.`,
        { variant: "success" }
      );
    },
  });

  document.getElementById("table-body").addEventListener("click", handleTableClick);
  document.querySelector(".asset-table thead").addEventListener("click", handleSortClick);
  document.getElementById("btn-refresh").addEventListener("click", () => refreshQuotes({ force: true }));
  document.getElementById("btn-export").addEventListener("click", exportPortfolio);
  document.getElementById("input-import").addEventListener("change", importPortfolio);
  window.addEventListener("resize", debounce(render, 200));

  renderMarketStatus(getMarketStatus());
  setInterval(() => renderMarketStatus(getMarketStatus()), 60 * 1000);

  render();
  refreshQuotes();
  fetchAvailableTickers()
    .then(setTickerSuggestions)
    .catch(() => {
      /* Autocompletar é opcional: sem a lista, o usuário digita o ticker. */
    });
}

init();
