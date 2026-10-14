import { KNOWN_ETFS, KNOWN_FIAGROS, DEFAULT_YIELD } from "./config.js";

/** Funções puras de domínio — sem acesso ao DOM. */

export function inferType(ticker) {
  if (KNOWN_ETFS.has(ticker)) return "ETF";
  if (KNOWN_FIAGROS.has(ticker)) return "Fiagro";
  if (/11$/.test(ticker)) return "FII";
  return "Ação";
}

export const defaultYieldFor = (type) => DEFAULT_YIELD[type] ?? 0;

/**
 * Adiciona um ativo. Se o ticker já existir, soma as cotas e recalcula o preço médio
 * ponderado — como faz uma corretora.
 */
export function addOrMergeAsset(assets, entry) {
  const existing = assets.find((a) => a.ticker === entry.ticker);
  if (!existing) {
    return { assets: [...assets, entry], merged: false };
  }

  const qty = existing.qty + entry.qty;
  const avgPrice = (existing.qty * existing.avgPrice + entry.qty * entry.avgPrice) / qty;
  const updated = {
    ...existing,
    qty,
    avgPrice,
    type: entry.type,
    currentPrice: entry.currentPrice || existing.currentPrice,
    dividendYield: entry.dividendYield,
    changePct: entry.changePct ?? existing.changePct,
    name: entry.name || existing.name,
  };
  return { assets: assets.map((a) => (a.id === existing.id ? updated : a)), merged: true };
}

/**
 * Junta linhas repetidas do mesmo ticker (dados salvos pela versão antiga do app,
 * que criava uma linha nova a cada compra). Mantém a primeira linha e recalcula o preço médio.
 */
export function consolidateAssets(assets) {
  const merged = assets.reduce((acc, asset) => addOrMergeAsset(acc, asset).assets, []);
  return merged.map((a) => {
    const inferred = inferType(a.ticker);
    // ETFs e Fiagros conhecidos têm o tipo corrigido; nos demais vale o que o usuário escolheu.
    return inferred === "ETF" || inferred === "Fiagro" ? { ...a, type: inferred } : a;
  });
}

export function changeQuantity(assets, id, delta) {
  return assets.map((a) => (a.id === id ? { ...a, qty: Math.max(1, a.qty + delta) } : a));
}

export const removeAsset = (assets, id) => assets.filter((a) => a.id !== id);

/** Calcula métricas por ativo e da carteira inteira. */
export function computePortfolio(assets) {
  const totalCurrent = assets.reduce((s, a) => s + a.qty * a.currentPrice, 0);

  const positions = assets.map((a) => {
    const posValue = a.qty * a.currentPrice;
    const costBasis = a.qty * a.avgPrice;
    const pnlAbs = posValue - costBasis;
    const prevClose = Number.isFinite(a.changePct) ? a.currentPrice / (1 + a.changePct / 100) : a.currentPrice;
    return {
      ...a,
      posValue,
      costBasis,
      pnlAbs,
      pnlPct: costBasis ? (pnlAbs / costBasis) * 100 : 0,
      allocPct: totalCurrent ? (posValue / totalCurrent) * 100 : 0,
      annDiv: (posValue * a.dividendYield) / 100,
      dayChange: a.qty * (a.currentPrice - prevClose),
    };
  });

  const totalInvested = positions.reduce((s, p) => s + p.costBasis, 0);
  const totalPnL = totalCurrent - totalInvested;
  const annualDivs = positions.reduce((s, p) => s + p.annDiv, 0);
  const dayChange = positions.reduce((s, p) => s + p.dayChange, 0);
  const prevTotal = totalCurrent - dayChange;

  const byType = positions.reduce((acc, p) => {
    acc[p.type] = (acc[p.type] ?? 0) + p.posValue;
    return acc;
  }, {});

  return {
    positions,
    byType,
    totals: {
      invested: totalInvested,
      current: totalCurrent,
      pnl: totalPnL,
      pnlPct: totalInvested ? (totalPnL / totalInvested) * 100 : 0,
      monthlyDivs: annualDivs / 12,
      yieldOnCost: totalInvested ? (annualDivs / totalInvested) * 100 : 0,
      dayChange,
      dayChangePct: prevTotal ? (dayChange / prevTotal) * 100 : 0,
    },
  };
}

export function sortPositions(positions, { key, dir }) {
  const factor = dir === "asc" ? 1 : -1;
  return [...positions].sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    if (typeof va === "string") return va.localeCompare(vb) * factor;
    return ((va ?? 0) - (vb ?? 0)) * factor;
  });
}

/**
 * Status aproximado do pregão regular da B3 (seg–sex, 10h–17h55, horário de Brasília).
 * Não considera feriados.
 */
export function getMarketStatus(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value;
  const weekday = get("weekday");
  const minutes = Number(get("hour")) * 60 + Number(get("minute"));
  const isWeekday = !["Sat", "Sun"].includes(weekday);
  return { open: isWeekday && minutes >= 600 && minutes < 1075 };
}
