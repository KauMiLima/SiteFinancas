const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const pct = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = new Intl.NumberFormat("pt-BR");

export const fmtBRL = (n) => brl.format(Number.isFinite(n) ? n : 0);
export const fmtBRLCompact = (n) => brlCompact.format(Number.isFinite(n) ? n : 0);
export const fmtInt = (n) => int.format(n);

/** Percentual com sinal: +1,23% / -0,45% */
export const fmtPct = (n, { signed = true } = {}) => {
  const value = Number.isFinite(n) ? n : 0;
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${pct.format(value)}%`;
};

export const fmtTime = (date) =>
  new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);

/** Classe CSS de acordo com o sinal do valor. */
export const signClass = (n) => (n > 0 ? "pos" : n < 0 ? "neg" : "");

const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHTML = (value) => String(value).replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);

export function debounce(fn, wait) {
  let timer;
  const debounced = (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
  debounced.cancel = () => clearTimeout(timer);
  return debounced;
}

/** Aceita "10,50", "1.234,56" ou "10.5". */
export function parseDecimal(value) {
  if (typeof value === "number") return value;
  const raw = String(value ?? "").trim();
  if (!raw) return NaN;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  return Number.parseFloat(normalized);
}

export const round2 = (n) => Math.round(n * 100) / 100;

/** Ticker no padrão B3: 4 letras + 1 ou 2 dígitos (ex.: PETR4, MXRF11, B5P211). */
export const isValidTicker = (ticker) => /^[A-Z0-9]{4}\d{1,2}F?$/.test(ticker);

export const normalizeTicker = (value) =>
  String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
