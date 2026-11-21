// Библиотека программ (локально, IndexedDB)
import { topHtml, navHtml, toast, ICONS } from './kit.js';
import { esc, highlightLine } from './highlight.js';
import { STATUSES, newItem, saveVersion, setStatus, filterItems, diffLines } from '../core/library.js';
import { libAll, libPut, libDelete } from '../libdb.js';
import { parseGcode } from '../gcode/parse.js';
import * as store from '../store.js';

const STCOLOR = { 'Черновик': '#9AA4B1', 'Ошибки в проверке': '#FF8A8A', 'Проверено на станке': '#6FD08C' };

// Миниатюра профиля: траектория в плоскости вида
export function thumbSvg(text, profile) {
  let moves = [];
  try { moves = parseGcode(text, { profile }).moves; } catch { /* пусто */ }
  const pts = moves.filter((m) => m.type !== 'G00').flatMap((m) => [m.from, m.to]);
  if (!pts.length) return '<svg width="56" height="56" viewBox="0 0 56 56"></svg>';
  const P = profile === 'MF' ? (p) => ({ x: p.x, y: p.y ?? 0 }) : (p) => ({ x: p.z, y: p.x / 2 });
  const q = pts.map(P);
  const xs = q.map((p) => p.x), ys = q.map((p) => p.y);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const sc = 48 / Math.max(maxx - minx, maxy - miny, 1e-6);
  const X = (p) => 4 + (p.x - minx) * sc, Y = (p) => 52 - (p.y - miny) * sc;
  const path = moves.filter((m) => m.type !== 'G00').map((m) => `M${X(P(m.from)).toFixed(1)} ${Y(P(m.from)).toFixed(1)}L${X(P(m.to)).toFixed(1)} ${Y(P(m.to)).toFixed(1)}`).join('');
  return `<svg width="56" height="56" viewBox="0 0 56 56"><path d="${path}" fill="none" stroke="#F5A524" stroke-width="1.5"/></svg>`;
}

export function render(root, ctx) {
  const st = { items: [], q: '', machine: '', fav: false, draft: false, open: null, diff: null, err: '' };
  root.innerHTML = `${topHtml('Библиотека', 'локально', 'gray')}<div class="page" id="pg"></div>${navHtml('#/library')}`;
  const pg = root.querySelector('#pg');
  const reload = () => libAll().then((a) => { st.items = a; st.err = ''; draw(); }).catch((e) => { st.err = e.message; draw(); });
  const cur = () => st.items.find((x) => x.id === st.open);

  function drawList() {
    const list = filterItems(st.items, st);
    pg.innerHTML = `${st.err ? `<div class="note bad">Хранилище недоступно: ${esc(st.err)}</div>` : ''}
      <input class="inp" id="q" placeholder="Поиск: название, O-номер, заказ" value="${esc(st.q)}">
      <div class="tabs"><button class="tg ${st.machine === '' ? 'on' : ''}" data-m="">Все</button><button class="tg ${st.machine === 'TF' ? 'on' : ''}" data-m="TF">TF</button><button class="tg ${st.machine === 'MF' ? 'on' : ''}" data-m="MF">MF</button>
        <button class="tg ${st.fav ? 'on' : ''}" data-f="fav">★ Избранное</button><button class="tg ${st.draft ? 'on' : ''}" data-f="draft">Черновики</button></div>
      <button class="btn pri" id="new" type="button">${ICONS.plus}Новая программа</button>
      <div style="display:flex;flex-direction:column;gap:10px">${list.length ? list.map((it) => `<div class="it2" data-open="${esc(it.id)}" style="cursor:pointer"><div style="width:64px;height:64px;border-radius:10px;background:#0E1013;border:1px solid #2C323A;display:flex;align-items:center;justify-content:center;flex:none">${thumbSvg(it.text, it.machine)}</div>
        <div class="x"><b>${esc(it.title)}${it.fav ? ' ★' : ''}</b><span class="meta">${esc(it.o || 'без номера')} · ${it.machine} · v${it.version} · ${it.date.slice(0, 10)}</span><span class="st" style="color:${STCOLOR[it.status]};border:1px solid ${STCOLOR[it.status]}55">${esc(it.status)}</span></div></div>`).join('') : '<div class="note info">Программ нет. Нажмите «Новая программа» или сохраните из «Импорт и проверка» / «Программа».</div>'}</div>
      <p style="margin:0;font-size:12px;color:#9AA4B1">Хранится на этом устройстве (IndexedDB). Синхронизация с Google Drive — в планах (v0.7).</p>`;
  }

  function drawItem(it) {
    const diff = st.diff ? diffLines(st.diff.text, it.text) : null;
    const journal = store.load('journal', []).filter((j) => j.part && (j.part === it.title || (it.o && j.part === it.o)));
    pg.innerHTML = `<button class="btn sm" data-back type="button" style="flex:none">← К списку</button>
      <div class="grid2"><div><label class="lbl">Название</label><input class="inp" data-f="title" value="${esc(it.title)}"></div><div><label class="lbl">O-номер</label><input class="inp" data-f="o" value="${esc(it.o)}"></div>
      <div><label class="lbl">Заказ</label><input class="inp" data-f="order" value="${esc(it.order)}"></div><div><label class="lbl">Станок</label><select class="inp" data-f="machine"><option ${it.machine === 'TF' ? 'selected' : ''}>TF</option><option ${it.machine === 'MF' ? 'selected' : ''}>MF</option></select></div></div>
      <div><label class="lbl">Статус (вручную; «Проверено на станке» — только вы)</label><select class="inp" data-f="status">${STATUSES.map((x) => `<option ${x === it.status ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div><label class="lbl">Программа · версия ${it.version}</label><textarea class="inp" id="txt" rows="10" spellcheck="false">${esc(it.text)}</textarea></div>
      <div class="btns"><button class="btn pri sm" data-act="savever" type="button">Сохранить версию</button><button class="btn sm" data-act="check" type="button">Проверить</button><button class="btn sm" data-act="plot" type="button">${ICONS.eye}На эскизе</button><button class="btn sm" data-act="fav" type="button">${ICONS.star}${it.fav ? 'Убрать' : 'В избранное'}</button></div>
      <div><label class="lbl">Заметки</label><textarea class="inp" data-f="notes" rows="3">${esc(it.notes)}</textarea></div>
      <section><h2 class="h2">История версий (${it.versions.length})</h2><div class="grp">${it.versions.length ? it.versions.slice().reverse().map((v, i) => `<div class="it" data-diffv="${it.versions.length - 1 - i}" style="cursor:pointer"><div class="x"><b>v${v.v}</b><span>${v.date.slice(0, 16).replace('T', ' ')}${v.note ? ' · ' + esc(v.note) : ''} — нажмите, чтобы увидеть отличия</span></div></div>`).join('') : '<div class="it"><div class="x"><span>Пока одна версия</span></div></div>'}</div></section>
      ${diff ? `<section><h2 class="h2">Отличия v${st.diff.v} → текущая</h2><div class="src">${diff.filter((d) => d.t !== '=' ).map((d) => `<div class="${d.t === '+' ? 'warn' : 'bad'}"><i>${d.t}</i><span>${highlightLine(d.s) || ' '}</span></div>`).join('') || '<div><i></i><span>без отличий</span></div>'}</div></section>` : ''}
      ${journal.length ? `<section><h2 class="h2">Журнал наладки</h2><div class="grp">${journal.map((j) => `<div class="it"><div class="x"><b>${esc(j.wcs)} · ${j.date.slice(0, 10)}</b><span>${esc(j.values)}</span></div></div>`).join('')}</div></section>` : ''}
      <button class="btn danger sm" data-act="del" type="button">${ICONS.trash}Удалить программу</button>`;
  }
  function draw() { const it = cur(); if (st.open && it) drawItem(it); else { st.open = null; drawList(); } }

  const save = (it) => libPut(it).then(() => { const i = st.items.findIndex((x) => x.id === it.id); if (i >= 0) st.items[i] = it; else st.items.push(it); });
  root.addEventListener('input', (e) => {
    if (e.target.id === 'q') { st.q = e.target.value; const pos = e.target.selectionStart; drawList(); const q = pg.querySelector('#q'); q.focus(); q.setSelectionRange(pos, pos); return; }
    const f = e.target.dataset && e.target.dataset.f;
    const it = cur();
    if (f && it && ['title', 'o', 'order', 'notes'].includes(f)) { it[f] = e.target.value; save(it); }
  });
  root.addEventListener('change', (e) => {
    const f = e.target.dataset && e.target.dataset.f;
    const it = cur();
    if (!f || !it) return;
    if (f === 'machine') { it.machine = e.target.value; save(it); }
    if (f === 'status') { save(setStatus(it, e.target.value, true)); }
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-open],[data-m],[data-f],#new,[data-back],[data-act],[data-diffv]');
    if (!b) return;
    const it = cur();
    if (b.dataset.open) { st.open = b.dataset.open; st.diff = null; draw(); }
    else if (b.dataset.m !== undefined) { st.machine = b.dataset.m; drawList(); }
    else if (b.dataset.f === 'fav' && !it) { st.fav = !st.fav; drawList(); }
    else if (b.dataset.f === 'draft') { st.draft = !st.draft; drawList(); }
    else if (b.id === 'new') { const n = newItem({ machine: ctx.settings.profile }); save(n).then(() => { st.open = n.id; draw(); }); }
    else if (b.dataset.back !== undefined) { st.open = null; draw(); }
    else if (b.dataset.diffv !== undefined && it) { st.diff = it.versions[+b.dataset.diffv]; draw(); }
    else if (b.dataset.act && it) {
      const a = b.dataset.act;
      if (a === 'savever') { const next = saveVersion(it, pg.querySelector('#txt').value); save(next).then(() => { toast(next === it ? 'Текст не изменился' : 'Версия сохранена'); draw(); }); }
      else if (a === 'fav') { it.fav = !it.fav; save(it).then(draw); }
      else if (a === 'check') { store.save('imp', { text: pg.querySelector('#txt').value, prof: it.machine, name: it.title }); location.hash = '#/importcheck'; }
      else if (a === 'plot') { store.save('bp', { lines: pg.querySelector('#txt').value.split(/\r?\n/), profile: it.machine, from: 'library' }); location.hash = it.machine === 'MF' ? '#/backplotmf' : '#/backplot'; }
      else if (a === 'del') { if (window.confirm('Удалить «' + it.title + '»?')) libDelete(it.id).then(() => { st.items = st.items.filter((x) => x.id !== it.id); st.open = null; draw(); }); }
    }
  });
  drawList();
  reload();
}
export default { id: 'library', render };
