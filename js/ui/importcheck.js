// Импорт и проверка чужой программы (п. 11.3)
import { topHtml, navHtml, toast, segHtml, ICONS } from './kit.js';
import { highlightLine, esc } from './highlight.js';
import { analyze, detectProfile, worst } from '../gcode/check.js';
import { parseNum } from '../gcode/format.js';
import { newItem } from '../core/library.js';
import { libPut, libAll } from '../libdb.js';
import * as store from '../store.js';

export function lineMarks(checks) {
  const marks = {};
  for (const c of checks) for (const it of c.items) if (it.line) { const lv = c.level === 'bad' ? 'bad' : 'warn'; if (marks[it.line] !== 'bad') marks[it.line] = lv; }
  return marks;
}

export function render(root, ctx) {
  const s = ctx.settings;
  const saved = store.load('imp', {});
  const st = { text: saved.text || '', prof: saved.prof || 'auto', stock: saved.stock ?? '', name: saved.name || '', res: null };
  root.innerHTML = `${topHtml('Импорт и проверка', st.prof === 'auto' ? 'авто' : '0i-' + st.prof, 'set')}<div class="page">
    <div class="btns"><label class="btn sm" style="cursor:pointer">Файл .nc / .txt<input id="file" type="file" accept=".nc,.txt,.cnc,.mpf,.tap,text/plain" hidden></label><button class="btn sm" id="paste" type="button">Из буфера</button><button class="btn sm" id="lib" type="button">Из библиотеки</button></div>
    <div id="libpick"></div>
    <textarea id="src" class="inp" rows="7" placeholder="Вставьте текст программы…" spellcheck="false">${esc(st.text)}</textarea>
    <div id="pf"></div>
    <div class="grid2"><div><label class="lbl" for="stock">Ø заготовки (TF)</label><div class="fld"><input id="stock" inputmode="decimal" value="${esc(st.stock)}"><span>мм</span></div><div class="hint">пусто — берётся X перед первым G71</div></div></div>
    <button class="btn pri" id="run" type="button">Проверить</button>
    <div id="out" style="display:flex;flex-direction:column;gap:14px"></div>
  </div>${navHtml('#/')}`;
  const $ = (q) => root.querySelector(q);
  const persist = () => store.save('imp', { text: st.text, prof: st.prof, stock: st.stock, name: st.name });
  const drawProf = () => { $('#pf').innerHTML = segHtml({ k: 'prof', options: [['auto', 'Авто'], ['TF', '0i-TF'], ['MF', '0i-MF']] }, st); };
  const run = () => {
    st.text = $('#src').value;
    st.stock = $('#stock').value;
    persist();
    if (!st.text.trim()) { $('#out').innerHTML = '<div class="note bad">Программа пустая</div>'; return; }
    const prof = st.prof === 'auto' ? detectProfile(st.text) : st.prof;
    const sd = parseNum(st.stock);
    st.res = analyze(st.text, { profile: prof, holder: s.holder, chuckZ: s.chuckZ, stock: prof === 'TF' && Number.isFinite(sd) ? { d: sd, zFace: 0 } : null });
    const r = st.res;
    const marks = lineMarks(r.checks);
    const lines = st.text.split(/\r?\n/);
    const level = worst(r.checks);
    const mins = r.summary.minutes;
    const issues = r.checks.filter((c) => c.items.length);
    $('#out').innerHTML = `
      <div class="note ${level === 'bad' ? 'bad' : level === 'warn' ? 'warn' : 'ok'}"><b>Профиль: 0i-${r.profile}${st.prof === 'auto' ? ' (определён автоматически)' : ''}. ${level === 'bad' ? 'Найдены ошибки' : level === 'warn' ? 'Есть замечания' : 'Проверки пройдены'}</b></div>
      <div class="kpi"><div><span>кадров</span><b>${r.summary.moves}</b></div><div><span>инструменты</span><b>${r.summary.tools.length ? r.summary.tools.map((t) => 'T' + t).join(' ') : '—'}</b></div><div><span>время ≈</span><b>${mins > 0 ? mins.toFixed(1) + ' мин' : '—'}</b></div></div>
      ${r.summary.unknown ? `<div class="note info">Для ${r.summary.unknown} перемещений подача или обороты не заданы — время неточное.</div>` : ''}
      <section><h2 class="h2">Проверки</h2><div class="card">${r.checks.map((c) => `<div class="iss"><span class="d" style="background:${c.level === 'bad' ? '#FF5C5C33' : c.level === 'warn' ? '#F5A52433' : '#2E5A3A66'};color:${c.level === 'bad' ? '#FF8A8A' : c.level === 'warn' ? '#F5A524' : '#6FD08C'}">${c.level === 'ok' ? '✓' : '!'}</span><div><b>${esc(c.title)}</b><span>${c.items.length ? c.items.map((i) => (i.line ? `строка ${i.line}: ` : '') + esc(i.text)).join('<br>') : 'без замечаний'}</span></div></div>`).join('')}</div></section>
      <section><h2 class="h2">Текст программы</h2><div class="src">${lines.map((l, i) => `<div class="${marks[i + 1] || ''}"><i>${i + 1}</i><span>${highlightLine(l) || ' '}</span></div>`).join('')}</div></section>
      <div class="btns"><button class="btn" id="plot" type="button">${ICONS.eye}На эскизе</button><button class="btn pri" id="tolib" type="button">В библиотеку</button></div>
      ${issues.length ? '' : ''}`;
  };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-seg],#run,#paste,#lib,#plot,#tolib,[data-pick]');
    if (!b) return;
    if (b.dataset.seg) { st.prof = b.dataset.v; persist(); drawProf(); }
    else if (b.id === 'run') run();
    else if (b.id === 'paste') navigator.clipboard.readText().then((t) => { $('#src').value = t; run(); }).catch(() => toast('Нет доступа к буферу — вставьте текст вручную'));
    else if (b.id === 'lib') {
      libAll().then((items) => { $('#libpick').innerHTML = items.length ? `<div class="grp">${items.map((it) => `<div class="it" data-pick="${esc(it.id)}" style="cursor:pointer"><div class="x"><b>${esc(it.title)}</b><span>${esc(it.o)} · ${it.machine}</span></div></div>`).join('')}</div>` : '<div class="note info">Библиотека пуста</div>'; libPicks = items; }).catch(() => toast('Библиотека недоступна'));
    } else if (b.dataset.pick) { const it = libPicks.find((x) => x.id === b.dataset.pick); if (it) { $('#src').value = it.text; st.prof = it.machine; st.name = it.title; drawProf(); $('#libpick').innerHTML = ''; run(); } }
    else if (b.id === 'plot' && st.res) { store.save('bp', { lines: st.text.split(/\r?\n/), profile: st.res.profile, stock: st.res.profile === 'TF' && Number.isFinite(parseNum(st.stock)) ? { d: parseNum(st.stock), zFace: 0 } : null, from: 'importcheck' }); location.hash = st.res.profile === 'MF' ? '#/backplotmf' : '#/backplot'; }
    else if (b.id === 'tolib' && st.res) {
      const m = st.text.match(/^\s*O(\d+)\s*(?:\(([^)]*)\))?/m);
      const it = newItem({ title: st.name || (m && m[2]) || 'Импортированная программа', o: m ? 'O' + m[1] : '', machine: st.res.profile, text: st.text });
      if (worst(st.res.checks) === 'bad') it.status = 'Ошибки в проверке';
      libPut(it).then(() => toast('Сохранено в библиотеку')).catch(() => toast('Библиотека недоступна'));
    }
  });
  let libPicks = [];
  $('#file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    $('#src').value = await f.text();
    st.name = f.name.replace(/\.[^.]+$/, '');
    run();
  });
  drawProf();
  if (st.text.trim()) run();
}
export default { id: 'importcheck', render };
