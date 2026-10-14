/**
 * Configurações globais da aplicação.
 *
 * O token da brapi NÃO fica neste arquivo: ele é lido de `js/env.js`, que está no
 * .gitignore. Copie `js/env.example.js` para `js/env.js` e coloque seu token lá.
 * Sem o arquivo, o app continua funcionando, mas a brapi só responde alguns
 * tickers de teste (PETR4, VALE3, ITUB4, MGLU3).
 */
async function loadToken() {
  try {
    const env = await import("./env.js");
    return env.BRAPI_TOKEN || "";
  } catch {
    console.warn("[B3 · PRO] js/env.js não encontrado — usando a brapi sem token.");
    return "";
  }
}

const BRAPI_TOKEN = await loadToken();

export const CONFIG = Object.freeze({
  BRAPI_BASE_URL: "https://brapi.dev/api",
  BRAPI_TOKEN,

  /** Cotações do plano gratuito têm ~30 min de atraso; cache evita gastar a cota mensal. */
  QUOTE_CACHE_TTL_MS: 15 * 60 * 1000,
  TICKERS_CACHE_TTL_MS: 24 * 60 * 60 * 1000,
  LOOKUP_DEBOUNCE_MS: 450,

  STORAGE_KEYS: Object.freeze({
    portfolio: "carteira_ativos",
    quotes: "b3pro:quotes",
    tickers: "b3pro:tickers",
    sort: "b3pro:sort",
  }),
});

export const ASSET_TYPES = Object.freeze(["Ação", "FII", "Fiagro", "ETF"]);

/** Dividend yield padrão sugerido por tipo (o usuário pode ajustar no cadastro). */
export const DEFAULT_YIELD = Object.freeze({
  "Ação": 6,
  FII: 10.5,
  Fiagro: 12,
  ETF: 0,
});

/** Cores por tipo — mesmas usadas nos badges do CSS. */
export const TYPE_COLORS = Object.freeze({
  "Ação": "#E8325A",
  FII: "#A855F7",
  Fiagro: "#F59E0B",
  ETF: "#06B6D4",
});

/** Paleta por ativo (gráfico de rosca e marcador da tabela). */
export const ASSET_PALETTE = Object.freeze([
  "#C41E3A", "#A855F7", "#06B6D4", "#F59E0B", "#22C55E",
  "#6366F1", "#FF6B7A", "#14B8A6", "#EAB308", "#8B5CF6",
]);

/** ETFs e Fiagros terminados em 11 — a brapi não informa o tipo no plano gratuito. */
export const KNOWN_ETFS = new Set([
  "BOVA11", "BOVV11", "BOVX11", "IVVB11", "SMAL11", "SMAC11", "DIVO11", "HASH11",
  "SPXI11", "NASD11", "XINA11", "GOLD11", "ECOO11", "FIND11", "MATB11", "PIBB11",
  "BRAX11", "ACWI11", "EURP11", "QBTC11", "ETHE11", "WRLD11", "B5P211", "IMAB11",
  "IRFM11", "FIXA11", "LFTS11", "NTNS11",
]);

export const KNOWN_FIAGROS = new Set([
  "RZAG11", "KNCA11", "VGIA11", "SNAG11", "FGAA11", "RURA11", "XPCA11", "CPTR11",
  "BTRA11", "OIAG11", "AGRX11", "GCRA11", "JGPX11", "VCRA11", "EGAF11", "KNSC11",
]);
