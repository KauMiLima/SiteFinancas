import { CONFIG, ASSET_TYPES } from "./config.js";

/** localStorage pode lançar erro (modo privado, cota cheia) — tudo passa por aqui. */
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/** Valida e normaliza um ativo (também migra dados salvos pela versão antiga). */
export function sanitizeAsset(raw) {
  if (!raw || typeof raw !== "object") return null;
  const ticker = String(raw.ticker ?? "").toUpperCase().trim();
  const qty = Math.floor(Number(raw.qty));
  const avgPrice = Number(raw.avgPrice);
  const currentPrice = Number(raw.currentPrice) || avgPrice;
  if (!ticker || !(qty > 0) || !(avgPrice > 0)) return null;

  return {
    id: String(raw.id ?? `${ticker}-${Date.now()}`),
    ticker,
    type: ASSET_TYPES.includes(raw.type) ? raw.type : "Ação",
    qty,
    avgPrice,
    currentPrice,
    dividendYield: Math.max(0, Number(raw.dividendYield) || 0),
    changePct: Number.isFinite(Number(raw.changePct)) ? Number(raw.changePct) : null,
    name: raw.name ? String(raw.name) : "",
  };
}

export function loadPortfolio() {
  const data = readJSON(CONFIG.STORAGE_KEYS.portfolio, []);
  return Array.isArray(data) ? data.map(sanitizeAsset).filter(Boolean) : [];
}

export const savePortfolio = (assets) => writeJSON(CONFIG.STORAGE_KEYS.portfolio, assets);

/** Cache simples com expiração. */
export function getCached(key, ttl) {
  const entry = readJSON(key, null);
  if (!entry || Date.now() - entry.savedAt > ttl) return null;
  return entry.value;
}

export const setCached = (key, value) => writeJSON(key, { savedAt: Date.now(), value });

/** Cache de cotações indexado por ticker. */
export function getCachedQuote(ticker) {
  const all = readJSON(CONFIG.STORAGE_KEYS.quotes, {});
  const entry = all[ticker];
  if (!entry || Date.now() - entry.savedAt > CONFIG.QUOTE_CACHE_TTL_MS) return null;
  return entry.value;
}

export function setCachedQuote(ticker, value) {
  const all = readJSON(CONFIG.STORAGE_KEYS.quotes, {});
  all[ticker] = { savedAt: Date.now(), value };
  writeJSON(CONFIG.STORAGE_KEYS.quotes, all);
}

export const loadPreference = (key, fallback) => readJSON(key, fallback);
export const savePreference = (key, value) => writeJSON(key, value);
