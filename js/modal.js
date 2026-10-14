import { CONFIG } from "./config.js";
import { fetchQuote } from "./api.js";
import { inferType, defaultYieldFor } from "./portfolio.js";
import { debounce, escapeHTML, fmtBRL, fmtPct, isValidTicker, normalizeTicker, parseDecimal, round2 } from "./utils.js";

const $ = (id) => document.getElementById(id);

const els = {};
const state = {
  controller: null,
  pendingLookup: null,
  quote: null,
  touched: { avg: false, yield: false, type: false },
  opener: null,
};

function setStatus(message = "", variant = "") {
  els.status.className = `lookup-status${variant ? ` is-${variant}` : ""}`;
  els.status.innerHTML = message;
}

function setError(message = "", field) {
  els.error.textContent = message;
  els.form.querySelectorAll("[aria-invalid]").forEach((el) => el.removeAttribute("aria-invalid"));
  if (field) {
    field.setAttribute("aria-invalid", "true");
    field.focus();
  }
}

function setManualPrice(enabled) {
  els.curr.readOnly = !enabled;
  els.curr.placeholder = enabled ? "Informe o preço" : "Automático";
}

function updateTotal() {
  const qty = Math.floor(parseDecimal(els.qty.value)) || 0;
  const price = parseDecimal(els.avg.value) || 0;
  els.total.textContent = fmtBRL(qty * price);
}

function resetQuoteFields() {
  state.quote = null;
  els.curr.value = "";
  setManualPrice(false);
  if (!state.touched.avg) els.avg.value = "";
  updateTotal();
}

function applyQuote(ticker, quote) {
  state.quote = quote;
  const type = inferType(ticker);
  if (!state.touched.type) els.type.value = type;
  if (!state.touched.yield) els.yield.value = defaultYieldFor(els.type.value).toFixed(2);

  els.curr.value = quote.price.toFixed(2);
  setManualPrice(false);
  if (!state.touched.avg) els.avg.value = quote.price.toFixed(2);
  updateTotal();

  const change = Number.isFinite(quote.changePct)
    ? ` <span class="${quote.changePct >= 0 ? "pos" : "neg"}">${fmtPct(quote.changePct)} hoje</span>`
    : "";
  const name = quote.name ? `${escapeHTML(quote.name)} · ` : "";
  setStatus(`✓ ${name}${fmtBRL(quote.price)}${change}`, "success");
}

function applyLookupError(ticker, err) {
  state.quote = null;
  if (!state.touched.type) els.type.value = inferType(ticker);
  if (!state.touched.yield) els.yield.value = defaultYieldFor(els.type.value).toFixed(2);
  setManualPrice(true);

  const message =
    err.code === "NOT_FOUND"
      ? "Ticker não encontrado. Confira o código ou informe o preço atual manualmente."
      : `${err.message}. Informe o preço atual manualmente.`;
  setStatus(message, "warning");
}

async function lookup(rawValue) {
  const ticker = normalizeTicker(rawValue);
  state.controller?.abort();

  if (!isValidTicker(ticker)) {
    setStatus("");
    resetQuoteFields();
    state.pendingLookup = null;
    return;
  }

  const controller = new AbortController();
  state.controller = controller;
  setStatus("Buscando cotação…");

  state.pendingLookup = fetchQuote(ticker, { signal: controller.signal })
    .then((quote) => {
      if (!controller.signal.aborted) applyQuote(ticker, quote);
    })
    .catch((err) => {
      if (err.code !== "ABORTED" && !controller.signal.aborted) applyLookupError(ticker, err);
    });

  await state.pendingLookup;
}

const debouncedLookup = debounce(lookup, CONFIG.LOOKUP_DEBOUNCE_MS);

function readForm() {
  return {
    ticker: normalizeTicker(els.ticker.value),
    type: els.type.value,
    qty: parseDecimal(els.qty.value),
    avgPrice: parseDecimal(els.avg.value),
    currentPrice: parseDecimal(els.curr.value),
    dividendYield: parseDecimal(els.yield.value) || 0,
  };
}

function validate(data) {
  if (!isValidTicker(data.ticker)) return ["Informe um ticker válido da B3 (ex.: PETR4, MXRF11).", els.ticker];
  if (!Number.isInteger(data.qty) || data.qty < 1) return ["A quantidade deve ser um número inteiro maior que zero.", els.qty];
  if (!(data.avgPrice > 0)) return ["Informe o preço pago por cota.", els.avg];
  if (!(data.currentPrice > 0)) {
    setManualPrice(true);
    return ["Não há cotação para este ticker. Informe o preço atual.", els.curr];
  }
  if (data.dividendYield < 0 || data.dividendYield > 100) return ["O DY deve estar entre 0% e 100%.", els.yield];
  return null;
}

function trapFocus(event) {
  if (event.key !== "Tab") return;
  const focusables = [...els.dialog.querySelectorAll("button, input:not([readonly]), select, [tabindex]:not([tabindex='-1'])")].filter(
    (el) => !el.disabled && el.offsetParent !== null
  );
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function onKeydown(event) {
  if (event.key === "Escape") closeModal();
  else trapFocus(event);
}

export function openModal() {
  state.opener = document.activeElement;
  els.overlay.hidden = false;
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", onKeydown);
  els.ticker.focus();
}

export function closeModal() {
  if (els.overlay.hidden) return;
  els.overlay.hidden = true;
  document.body.style.overflow = "";
  document.removeEventListener("keydown", onKeydown);

  debouncedLookup.cancel();
  state.controller?.abort();
  state.pendingLookup = null;
  state.touched = { avg: false, yield: false, type: false };
  els.form.reset();
  resetQuoteFields();
  setStatus("");
  setError("");
  state.opener?.focus?.();
}

export function setTickerSuggestions(tickers) {
  els.datalist.innerHTML = tickers.map((t) => `<option value="${escapeHTML(t)}"></option>`).join("");
}

/** @param {{ onSubmit: (asset: object) => void }} options */
export function initModal({ onSubmit }) {
  Object.assign(els, {
    overlay: $("modal-cadastro"),
    dialog: document.querySelector("#modal-cadastro .modal"),
    form: $("form-ativo"),
    ticker: $("in-ticker"),
    type: $("in-type"),
    qty: $("in-qty"),
    avg: $("in-avg"),
    curr: $("in-curr"),
    yield: $("in-yield"),
    total: $("in-total-preview"),
    status: $("lookup-status"),
    error: $("form-error"),
    datalist: $("tickers-sugestoes"),
  });

  $("btn-open-modal").addEventListener("click", openModal);
  $("btn-close-modal").addEventListener("click", closeModal);
  els.form.querySelector("[data-close-modal]").addEventListener("click", closeModal);
  els.overlay.addEventListener("mousedown", (e) => {
    if (e.target === els.overlay) closeModal();
  });

  els.ticker.addEventListener("input", (e) => {
    setError("");
    debouncedLookup(e.target.value);
  });
  // Seleção no <datalist> dispara "change": busca na hora, sem esperar o debounce.
  els.ticker.addEventListener("change", (e) => {
    debouncedLookup.cancel();
    lookup(e.target.value);
  });

  els.qty.addEventListener("input", updateTotal);
  els.avg.addEventListener("input", () => {
    state.touched.avg = els.avg.value !== "";
    updateTotal();
  });
  els.yield.addEventListener("input", () => (state.touched.yield = true));
  els.type.addEventListener("change", () => {
    state.touched.type = true;
    if (!state.touched.yield) els.yield.value = defaultYieldFor(els.type.value).toFixed(2);
  });

  els.form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setError("");

    // Se o usuário enviar antes do debounce, faz a busca agora e espera.
    if (debouncedLookup && !state.quote && els.curr.readOnly) {
      debouncedLookup.cancel();
      await lookup(els.ticker.value);
    } else if (state.pendingLookup) {
      await state.pendingLookup;
    }

    const data = readForm();
    const problem = validate(data);
    if (problem) {
      setError(...problem);
      return;
    }

    onSubmit({
      id: `${data.ticker}-${Date.now()}`,
      ticker: data.ticker,
      type: data.type,
      qty: data.qty,
      avgPrice: round2(data.avgPrice),
      currentPrice: data.currentPrice,
      dividendYield: data.dividendYield,
      changePct: state.quote?.changePct ?? null,
      name: state.quote?.name ?? "",
    });
    closeModal();
  });
}
