import { CONFIG } from "./config.js";
import { getCached, setCached, getCachedQuote, setCachedQuote } from "./storage.js";

export class QuoteError extends Error {
  /** @param {"NOT_FOUND"|"UNAUTHORIZED"|"RATE_LIMIT"|"NETWORK"|"ABORTED"} code */
  constructor(code, message) {
    super(message);
    this.name = "QuoteError";
    this.code = code;
  }
}

/**
 * O plano gratuito da brapi permite 1 requisição simultânea e 1 ticker por chamada.
 * Esta fila garante que as chamadas saiam uma por vez.
 */
let queue = Promise.resolve();
function enqueue(task) {
  const run = queue.then(task, task);
  queue = run.catch(() => {});
  return run;
}

function buildURL(path) {
  const url = new URL(`${CONFIG.BRAPI_BASE_URL}${path}`);
  if (CONFIG.BRAPI_TOKEN) url.searchParams.set("token", CONFIG.BRAPI_TOKEN);
  return url;
}

async function request(path, { signal } = {}) {
  let response;
  try {
    response = await fetch(buildURL(path), { signal });
  } catch (err) {
    if (err.name === "AbortError") throw new QuoteError("ABORTED", "Requisição cancelada");
    throw new QuoteError("NETWORK", "Sem conexão com a brapi");
  }

  if (response.status === 404) throw new QuoteError("NOT_FOUND", "Ticker não encontrado");
  if (response.status === 401 || response.status === 403)
    throw new QuoteError("UNAUTHORIZED", "Token da brapi inválido ou sem permissão");
  if (response.status === 429) throw new QuoteError("RATE_LIMIT", "Limite de requisições atingido");
  if (!response.ok) throw new QuoteError("NETWORK", `Erro HTTP ${response.status}`);

  return response.json();
}

/**
 * Busca a cotação de um ticker (com cache local).
 * @returns {Promise<{symbol:string, price:number, changePct:number|null, name:string}>}
 */
export function fetchQuote(ticker, { signal, force = false } = {}) {
  if (!force) {
    const cached = getCachedQuote(ticker);
    if (cached) return Promise.resolve(cached);
  }

  return enqueue(async () => {
    if (signal?.aborted) throw new QuoteError("ABORTED", "Requisição cancelada");

    const data = await request(`/quote/${encodeURIComponent(ticker)}`, { signal });
    const result = data?.results?.[0];
    if (!result || !(result.regularMarketPrice > 0)) {
      throw new QuoteError("NOT_FOUND", "Ticker não encontrado");
    }

    const quote = {
      symbol: result.symbol,
      price: result.regularMarketPrice,
      changePct: Number.isFinite(result.regularMarketChangePercent)
        ? result.regularMarketChangePercent
        : null,
      name: result.longName || result.shortName || "",
    };
    setCachedQuote(ticker, quote);
    return quote;
  });
}

/**
 * Atualiza vários tickers em sequência, chamando `onQuote` a cada resultado.
 * Retorna quantos falharam.
 */
export async function fetchQuotes(tickers, { force = false, onQuote } = {}) {
  let failures = 0;
  for (const ticker of tickers) {
    try {
      const quote = await fetchQuote(ticker, { force });
      onQuote?.(ticker, quote);
    } catch (err) {
      failures += 1;
      if (err.code === "RATE_LIMIT" || err.code === "UNAUTHORIZED") {
        failures += tickers.length - tickers.indexOf(ticker) - 1;
        break;
      }
    }
  }
  return failures;
}

/** Lista de tickers negociados na B3, usada no autocompletar (cache de 24h). */
export async function fetchAvailableTickers() {
  const cached = getCached(CONFIG.STORAGE_KEYS.tickers, CONFIG.TICKERS_CACHE_TTL_MS);
  if (cached) return cached;

  const data = await enqueue(() => request("/available"));
  const tickers = Array.isArray(data?.stocks)
    ? [...new Set(data.stocks.map((t) => String(t).toUpperCase().trim()))].sort()
    : [];
  if (tickers.length) setCached(CONFIG.STORAGE_KEYS.tickers, tickers);
  return tickers;
}
