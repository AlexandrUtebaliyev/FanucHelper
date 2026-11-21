// Общий каркас экранов: шапка, форма, результаты, блок G-кода, кнопки.
import { highlight, esc } from './highlight.js';
import { parseNum } from '../gcode/format.js';
import * as store from '../store.js';

export const CATS = { geo: 'Геометрия', cyc: 'Циклы', mode: 'Режимы', mac: 'Макросы', set: 'Наладка' };
export const DISCLAIMER = 'Перед запуском проверь в графике стойки и пройди первую деталь в покадровом режиме с уменьшенной подачей';

const svg = (inner, w = 22) => `<svg width="${w}" height="${w}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
export const ICONS = {
  back: svg('<path d="M15 18l-6-6 6-6"/>', 24),
  copy: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>', 18),
  plus: svg('<path d="M12 5v14M5 12h14"/>', 18),
  star: svg('<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>', 18),
  eye: svg('<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', 16),
  warn: svg('<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>', 20),
  chev: svg('<path d="M9 6l6 6-6 6"/>', 18),
  up: svg('<path d="M6 15l6-6 6 6"/>', 18),
  down: svg('<path d="M6 9l6 6 6-6"/>', 18),
  trash: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', 18),
};
const NAV = [
  ['#/', 'Расчёты', svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/>')],
  ['#/program', 'Программа', svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M10 13l-2 2 2 2M14 13l2 2-2 2"/>')],
  ['#/library', 'Библиотека', svg('<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>')],
  ['#/settings', 'Настройки', svg('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1"/>')],
];
export function navHtml(active) {
  return `<nav class="nav" aria-label="Разделы">${NAV.map(([h, t, i]) => `<a href="${h}" class="${h === active ? 'on' : ''}">${i}${t}</a>`).join('')}</nav>`;
}
export function topHtml(title, chip = '', cat = '', back = '#/') {
  return `<header class="top"><a class="back" href="${back}" aria-label="Назад">${ICONS.back}</a><h1>${esc(title)}</h1>${chip ? `<span class="chip ${cat}">${esc(chip)}</span>` : ''}</header>`;
}
export const disclaimerHtml = () => `<div class="disc"><span style="color:#F5A524;flex:none">${ICONS.warn}</span><p>${DISCLAIMER}.</p></div>`;

export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch { /* нет доступа к буферу */ }
    ta.remove();
  }
  toast('Скопировано');
}
export const go = (h) => { location.hash = h; };

// ---------- поля ----------
function fieldHtml(f0, v) {
  const f = typeof f0.label === 'function' ? { ...f0, label: f0.label(v) } : f0;
  const id = 'f_' + f.k;
  if (f.type === 'select') {
    return `<div><label class="lbl" for="${id}">${f.label}</label><div class="fld"><select id="${id}" data-k="${f.k}">${(typeof f.options === 'function' ? f.options(v) : f.options).map(([val, lab]) => `<option value="${esc(val)}"${String(v[f.k]) === String(val) ? ' selected' : ''}>${esc(lab)}</option>`).join('')}</select></div></div>`;
  }
  return `<div${f.full ? ' style="grid-column:1/-1"' : ''}><label class="lbl" for="${id}">${f.label}</label><div class="fld"><input id="${id}" data-k="${f.k}" ${f.type === 'text' ? '' : 'inputmode="decimal"'} autocomplete="off" value="${esc(v[f.k] ?? '')}">${f.unit ? `<span>${f.unit}</span>` : ''}</div>${f.hint ? `<div class="hint">${f.hint}</div>` : ''}</div>`;
}
export function segHtml(f, v) {
  return `<div class="seg" style="grid-template-columns:repeat(${f.options.length},minmax(0,1fr))">${f.options.map(([val, lab]) => `<button type="button" data-seg="${f.k}" data-v="${esc(val)}" class="${String(v[f.k]) === String(val) ? 'on' : ''}">${lab}</button>`).join('')}</div>`;
}
export function formHtml(def, v) {
  let html = '';
  let grid = [];
  const flush = () => { if (grid.length) { html += `<div class="grid2">${grid.join('')}</div>`; grid = []; } };
  for (const f of def.form) {
    if (f.show && !f.show(v)) continue;
    if (f.type === 'seg') { flush(); html += segHtml(f, v); }
    else if (f.type === 'check') { flush(); html += `<div><button type="button" class="tg ${v[f.k] ? 'on' : ''}" data-chk="${f.k}">${f.label}</button></div>`; }
    else if (f.type === 'note') { flush(); html += `<div class="note info">${f.text}</div>`; }
    else grid.push(fieldHtml(f, v));
  }
  flush();
  return html;
}
export function parseValues(def, v) {
  const p = {};
  for (const f of def.form) {
    if (f.type === 'num') p[f.k] = parseNum(v[f.k]);
    else if (f.type === 'check') p[f.k] = !!v[f.k];
    else p[f.k] = v[f.k];
  }
  return p;
}
export const nn = (x) => typeof x === 'number' && Number.isFinite(x);

// ---------- результаты ----------
export function resultsHtml(r) {
  let html = '';
  if (r.err) html += `<div class="note bad">${esc(r.err)}</div>`;
  for (const w of r.warn || []) html += `<div class="note warn">${esc(w)}</div>`;
  for (const w of r.ok || []) html += `<div class="note ok">${esc(w)}</div>`;
  if (r.results && r.results.length) {
    html += `<section><h2 class="h2">Результаты</h2><div class="card pad">${r.results.map((x) => { const [l, val] = Array.isArray(x) ? x : [x.l, x.v]; return `<div class="row"><span>${l}</span><b>${val}</b></div>`; }).join('')}</div></section>`;
  }
  if (r.extra) html += r.extra;
  return html;
}

export function codeSection(lines, opts = {}) {
  if (!lines || !lines.length) return '';
  return `<section><div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px"><h2 class="h2" style="margin:0">G-код${opts.beta ? ' <span class="beta">бета</span>' : ''}</h2>
  <button type="button" data-act="plot" style="display:flex;align-items:center;gap:6px;min-height:40px;padding:0 12px;border-radius:9px;border:1px solid #FF7AB666;background:#FF7AB61A;color:#FF9FCB;font:600 13px var(--sans)">${ICONS.eye}Проверить на эскизе</button></div>
  <div class="code" id="codebox">${highlight(lines)}</div></section>
  <div class="btns"><button class="btn" type="button" data-act="copy">${ICONS.copy}Копировать</button><button class="btn" type="button" data-act="fav">${ICONS.star}В избранное</button><button class="btn pri" type="button" data-act="prog">${ICONS.plus}В программу</button></div>
  ${disclaimerHtml()}`;
}

export function actionHandlers(def, ctx, getState) {
  return (act) => {
    const { r, v } = getState();
    if (!r || !r.code) return;
    const text = r.code.join('\n');
    const rec = { screen: def.id, title: r.title || def.title, tag: r.tag || def.tag || '', cat: def.cat, values: v };
    if (act === 'copy') { copyText(text); store.pushRecent(rec); }
    if (act === 'fav') toast(store.toggleFav(rec) ? 'Добавлено в избранное' : 'Убрано из избранного');
    if (act === 'prog') {
      store.addBlock({ title: r.title || def.title, tag: r.tag || '', cat: def.cat, lines: r.code, profile: ctx.settings.profile });
      store.pushRecent(rec);
      toast('Блок добавлен в программу');
    }
    if (act === 'plot') {
      store.save('bp', { lines: r.code, profile: ctx.settings.profile, stock: r.stock || null, from: def.id });
      go(ctx.settings.profile === 'MF' ? '#/backplotmf' : '#/backplot');
    }
  };
}

// ---------- экран по описанию ----------
export function renderScreen(root, def, ctx) {
  const s = ctx.settings;
  let v = { ...def.defaults, ...(store.getScreenValues(def.id) || {}) };
  let r = null;
  const chipText = def.chip ? def.chip(s) : (s.profile === 'MF' ? '0i-MF' : `0i-TF · ${s.gsys}`);
  root.innerHTML = `${topHtml(def.title, chipText, def.cat)}<div class="page"><div id="sk"></div><div id="fm" style="display:flex;flex-direction:column;gap:12px"></div><div id="rs" style="display:flex;flex-direction:column;gap:14px"></div></div>${navHtml('#/')}`;
  const $ = (q) => root.querySelector(q);
  const drawForm = () => { $('#fm').innerHTML = formHtml(def, v); };
  const drawResult = () => {
    const p = parseValues(def, v);
    try { r = def.calc(p, s, v) || {}; } catch (e) { r = { err: e.message }; }
    $('#sk').innerHTML = r.sketch ? `<div class="card sketch">${r.sketch}</div>` : '';
    $('#rs').innerHTML = resultsHtml(r) + (r.err ? '' : codeSection(r.code, { beta: def.beta }));
  };
  const act = actionHandlers(def, ctx, () => ({ r, v }));
  root.addEventListener('input', (e) => {
    const k = e.target.dataset && e.target.dataset.k;
    if (!k) return;
    v[k] = e.target.value;
    store.setScreenValues(def.id, v);
    if (e.target.tagName === 'SELECT') drawForm();
    drawResult();
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-seg],[data-chk],[data-act]');
    if (!b) return;
    if (b.dataset.seg) { v[b.dataset.seg] = b.dataset.v; store.setScreenValues(def.id, v); drawForm(); drawResult(); }
    else if (b.dataset.chk) { v[b.dataset.chk] = !v[b.dataset.chk]; store.setScreenValues(def.id, v); drawForm(); drawResult(); }
    else if (b.dataset.act) act(b.dataset.act);
  });
  drawForm();
  drawResult();
}
