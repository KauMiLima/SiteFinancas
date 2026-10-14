import { ASSET_TYPES, TYPE_COLORS } from "./config.js";
import { escapeHTML, fmtBRL, fmtInt, fmtPct, fmtTime, signClass } from "./utils.js";

const $ = (id) => document.getElementById(id);

function setValue(id, text, extraClass) {
  const el = $(id);
  el.textContent = text;
  if (extraClass !== undefined) {
    el.classList.remove("pos", "neg");
    if (extraClass) el.classList.add(extraClass);
  }
}

export function renderSummary({ totals }, assetCount) {
  setValue("side-invested", fmtBRL(totals.invested));
  setValue("side-current", fmtBRL(totals.current));
  setValue("side-pnl", fmtBRL(totals.pnl), signClass(totals.pnl));

  setValue("kpi-patrimonio", fmtBRL(totals.current));
  setValue("kpi-patrimonio-sub", `${fmtPct(totals.pnlPct)} desde a compra`, signClass(totals.pnlPct));
  setValue("kpi-resultado", fmtBRL(totals.pnl), signClass(totals.pnl));
  setValue("kpi-dia", fmtBRL(totals.dayChange), signClass(totals.dayChange));
  setValue("kpi-dia-sub", fmtPct(totals.dayChangePct), signClass(totals.dayChangePct));
  setValue("kpi-dividendo", fmtBRL(totals.monthlyDivs));
  setValue("kpi-dividendo-sub", `${fmtPct(totals.yieldOnCost, { signed: false })} yield on cost a.a.`);

  setValue("header-count", `${assetCount} ${assetCount === 1 ? "ativo" : "ativos"}`);
}

export function renderAllocBars({ byType, totals }) {
  const container = $("sidebar-alloc-bars");
  const rows = ASSET_TYPES.map((type) => ({
    type,
    pct: totals.current ? ((byType[type] ?? 0) / totals.current) * 100 : 0,
  })).filter((r) => r.pct > 0);

  if (!rows.length) {
    container.innerHTML = `<p class="empty-hint">A distribuição aparece aqui depois do primeiro ativo.</p>`;
    return;
  }

  container.innerHTML = rows
    .map(
      ({ type, pct }) => `
      <div>
        <div class="alloc-header">
          <span>${type}</span>
          <span>${fmtPct(pct, { signed: false })}</span>
        </div>
        <div class="alloc-track" role="progressbar" aria-label="${type}" aria-valuenow="${pct.toFixed(0)}" aria-valuemin="0" aria-valuemax="100">
          <div class="alloc-fill" style="width:${pct}%;background:${TYPE_COLORS[type]}"></div>
        </div>
      </div>`
    )
    .join("");
}

export function renderTable(positions) {
  const tbody = $("table-body");

  if (!positions.length) {
    tbody.innerHTML = `
      <tr class="table-empty">
        <td colspan="8">Nenhum ativo na carteira ainda. Clique em <strong>+ Novo ativo</strong> para começar.</td>
      </tr>`;
    return;
  }

  tbody.innerHTML = positions
    .map((p) => {
      const ticker = escapeHTML(p.ticker);
      const name = p.name ? `<div class="cell-sub">${escapeHTML(p.name)}</div>` : "";
      const day = Number.isFinite(p.changePct)
        ? `<div class="cell-sub ${signClass(p.changePct)}">${fmtPct(p.changePct)} hoje</div>`
        : "";

      return `
      <tr data-id="${escapeHTML(p.id)}">
        <td class="col-left">
          <div class="asset-cell">
            <span class="asset-dot" style="background:${p.color}" aria-hidden="true"></span>
            <div>
              <span class="asset-ticker">${ticker}</span>
              <span class="badge" data-type="${p.type}">${p.type}</span>
              ${name}
            </div>
          </div>
        </td>
        <td class="col-center">
          <div class="qty-control">
            <button type="button" class="qty-btn" data-action="dec" aria-label="Remover 1 cota de ${ticker}" ${p.qty <= 1 ? "disabled" : ""}>−</button>
            <span class="qty-value">${fmtInt(p.qty)}</span>
            <button type="button" class="qty-btn" data-action="inc" aria-label="Adicionar 1 cota de ${ticker}">+</button>
          </div>
        </td>
        <td>${fmtBRL(p.avgPrice)}</td>
        <td>${fmtBRL(p.currentPrice)}${day}</td>
        <td><strong>${fmtBRL(p.posValue)}</strong><div class="cell-sub">${fmtPct(p.allocPct, { signed: false })} da carteira</div></td>
        <td>
          <div class="${signClass(p.pnlAbs)}"><strong>${fmtBRL(p.pnlAbs)}</strong></div>
          <div class="cell-sub ${signClass(p.pnlPct)}">${fmtPct(p.pnlPct)}</div>
        </td>
        <td class="pos">${fmtBRL(p.annDiv)}<div class="cell-sub">DY ${fmtPct(p.dividendYield, { signed: false })}</div></td>
        <td class="col-center">
          <button type="button" class="btn btn-danger" data-action="remove">Remover</button>
        </td>
      </tr>`;
    })
    .join("");
}

export function renderSortIndicators(sort) {
  document.querySelectorAll(".asset-table th[data-sort]").forEach((th) => {
    if (th.dataset.sort === sort.key) {
      th.setAttribute("aria-sort", sort.dir === "asc" ? "ascending" : "descending");
    } else {
      th.removeAttribute("aria-sort");
    }
  });
}

/** Faixa superior com a variação do dia dos ativos da carteira. */
export function renderTicker(positions) {
  const container = $("ticker-container");
  const items = positions.filter((p) => Number.isFinite(p.changePct));

  if (!items.length) {
    container.classList.add("is-static");
    container.innerHTML = `<span class="ticker-item">Adicione ativos para acompanhar a variação do dia aqui.</span>`;
    return;
  }

  // Repete a lista até preencher a faixa, depois duplica para o loop contínuo.
  const minItems = 8;
  const base = Array.from({ length: Math.ceil(minItems / items.length) }, () => items).flat();
  const html = [...base, ...base]
    .map(
      (p) => `
      <span class="ticker-item">
        <strong>${escapeHTML(p.ticker)}</strong>
        <span>${fmtBRL(p.currentPrice)}</span>
        <span class="${signClass(p.changePct)}">${fmtPct(p.changePct)}</span>
      </span>`
    )
    .join("");

  container.classList.remove("is-static");
  container.innerHTML = html;
}

export function renderMarketStatus({ open }) {
  const el = $("market-status");
  el.classList.toggle("is-open", open);
  el.querySelector(".status-label").textContent = open ? "Pregão aberto · B3" : "Pregão fechado · B3";
}

export function renderLastUpdate(date, failures = 0) {
  const el = $("last-update");
  if (!date) return;
  const suffix = failures ? ` · ${failures} sem cotação` : "";
  el.textContent = `Atualizado às ${fmtTime(date)} (atraso ~30 min)${suffix}`;
}

export function setRefreshing(isRefreshing) {
  const btn = $("btn-refresh");
  btn.disabled = isRefreshing;
  btn.classList.toggle("is-loading", isRefreshing);
}

/** Notificação temporária, com ação opcional (ex.: "Desfazer"). */
export function showToast(message, { variant, actionLabel, onAction, duration = 5000 } = {}) {
  const region = $("toast-region");
  const toast = document.createElement("div");
  toast.className = `toast${variant ? ` is-${variant}` : ""}`;
  toast.innerHTML = `<span>${escapeHTML(message)}</span>`;

  const close = () => toast.remove();
  if (actionLabel && onAction) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = actionLabel;
    btn.addEventListener("click", () => {
      onAction();
      close();
    });
    toast.append(btn);
  }

  region.append(toast);
  setTimeout(close, duration);
}
