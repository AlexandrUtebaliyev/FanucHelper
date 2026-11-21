// Сборщик программы (п. 3.10): блоки из экранов расчёта + автоматические шапка и концовка
import { topHtml, navHtml, copyText, toast, ICONS, segHtml, disclaimerHtml } from './kit.js';
import { highlight, esc } from './highlight.js';
import { buildProgram, DEFAULT_OPTS, duplicateN, toFileText, fileName, safeTitle } from '../gcode/program.js';
import { analyze, worst } from '../gcode/check.js';
import { parseNum } from '../gcode/format.js';
import { newItem } from '../core/library.js';
import { libPut } from '../libdb.js';
import * as store from '../store.js';

const TAGCOL = { geo: '#6FB3FF', cyc: '#F5A524', mode: '#5FD08A', mac: '#B79CFF', set: '#5FD3D3' };

export function assemble(blocks, opts, s) {
  const lines = buildProgram(blocks, opts, s);
  const dup = duplicateN(lines);
  return { lines, dup };
}

export function render(root, ctx) {
  const s = ctx.settings;
  const prof = s.profile === 'MF' ? 'MF' : 'TF';
  const saved = store.load('progopts', {});
  const opts = { ...DEFAULT_OPTS[prof], ...(saved[prof] || {}), o: (saved[prof] && saved[prof].o) ?? s.progNo };
  let blocks = store.getBlocks();
  const persist = () => store.save('progopts', { ...saved, [prof]: opts });
  root.innerHTML = `${topHtml('Программа', prof === 'MF' ? '0i-MF' : `0i-TF · ${s.gsys}`, 'gray')}<div class="page" id="pg"></div>${navHtml('#/program')}`;
  const pg = root.querySelector('#pg');
  let current = { lines: [], err: '' };

  const field = (k, label, unit = '', type = 'num') => `<div><label class="lbl" for="o_${k}">${label}</label><div class="fld"><input id="o_${k}" data-o="${k}" ${type === 'num' ? 'inputmode="decimal"' : ''} value="${esc(opts[k] ?? '')}">${unit ? `<span>${unit}</span>` : ''}</div></div>`;

  function head() {
    if (prof === 'MF') {
      return `<div class="grid2">${field('title', 'Название', '', 'text')}${field('o', 'Номер O')}
        <div><label class="lbl">Система координат</label><div class="fld"><select data-o="wcs">${['G54', 'G55', 'G56', 'G57', 'G58', 'G59'].map((w) => `<option ${opts.wcs === w ? 'selected' : ''}>${w}</option>`).join('')}</select></div></div>
        ${field('tool', 'Инструмент T')}${field('rpm', 'Обороты S', 'об/мин')}${field('h', 'Коррекция длины H')}${field('safeZ', 'Безопасный Z', 'мм')}</div>`;
    }
    return `<div class="grid2">${field('title', 'Название', '', 'text')}${field('o', 'Номер O')}${field('tool', 'Инструмент T', '', 'text')}</div>
      ${segHtml({ k: 'mode', options: [['g96', 'G96 (Vc)'], ['g97', 'G97 (об/мин)']] }, opts)}
      <div class="grid2">${opts.mode === 'g96' ? field('vc', 'Vc', 'м/мин') + field('g50', 'G50 S (предел)', 'об/мин') : field('rpm', 'Обороты S', 'об/мин')}</div>`;
  }

  function out() {
    const o = { ...opts };
    for (const k of ['o', 'vc', 'g50', 'rpm', 'h', 'safeZ']) if (typeof o[k] === 'string') o[k] = parseNum(o[k]);
    if (prof === 'MF') { o.tool = parseNum(o.tool); o.homeXY = s.refTrim; } else o.ref = s.refTrim;
    current = { lines: [], err: '' };
    try { current = { ...assemble(blocks, o, s), err: '' }; } catch (e) { current = { lines: [], dup: [], err: e.message }; }
    current.o = o;
    const body = pg.querySelector('#prev');
    if (!body) return;
    body.innerHTML = current.err ? `<div class="note bad">${esc(current.err)}</div>` : `<div class="code" style="font-size:13px;line-height:1.6;max-height:320px;overflow:auto">${highlight(current.lines)}</div>`;
    pg.querySelector('#chk').innerHTML = current.err ? '' : checks();
  }

  function checks() {
    const parts = [];
    if (current.dup && current.dup.length) parts.push(`<div class="note bad"><b>Повторяются номера N: ${[...new Set(current.dup.map((d) => 'N' + d.n))].join(', ')}.</b> G70 P.. Q.. найдёт первый кадр с этим номером — программа пойдёт не по тому контуру. Измените номера контуров (поля N начала/конца) в экране «Контур».</div>`);
    if (!blocks.length) parts.push('<div class="note info">Блоков пока нет: нажмите «В программу» на экранах расчёта.</div>');
    const a = analyze(current.lines.join('\n'), { profile: prof, holder: s.holder, chuckZ: s.chuckZ });
    const lv = worst(a.checks);
    parts.push(`<div class="note ${lv === 'bad' ? 'bad' : lv === 'warn' ? 'warn' : 'ok'}"><div><b>${lv === 'bad' ? 'Автопроверки нашли ошибки' : lv === 'warn' ? 'Автопроверки: есть замечания' : 'Автопроверки пройдены'}</b>${a.checks.filter((c) => c.items.length).map((c) => `<div>${esc(c.title)}: ${c.items.map((i) => (i.line ? `стр. ${i.line} — ` : '') + esc(i.text)).join('; ')}</div>`).join('')}</div></div>`);
    return parts.join('');
  }

  function draw() {
    pg.innerHTML = `<section><h2 class="h2">Шапка</h2><div style="display:flex;flex-direction:column;gap:12px">${head()}</div></section>
      <section><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h2 class="h2" style="margin:0">Блоки (${blocks.length})</h2>${blocks.length ? '<button class="tg" data-clear type="button">Очистить</button>' : ''}</div>
        <div style="display:flex;flex-direction:column;gap:8px">${blocks.map((b, i) => `<div class="blk"><span class="t" style="background:${TAGCOL[b.cat] || '#2C323A'};color:#141210">${esc(b.tag || '•')}</span><div class="x"><b>${esc(b.title)}</b><span>${esc(b.lines[0] || '')}</span></div>
          <button class="ib" data-up="${i}" aria-label="Выше">${ICONS.up}</button><button class="ib" data-down="${i}" aria-label="Ниже">${ICONS.down}</button><button class="ib" data-del="${i}" aria-label="Удалить">${ICONS.trash}</button></div>`).join('') || '<div class="note info">Список пуст.</div>'}</div></section>
      <section><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><h2 class="h2" style="margin:0">Просмотр</h2><button class="tg ${s.numbering ? 'on' : ''}" data-num type="button">Нумерация N${s.numbering ? ' · ' + (s.numStep || 10) : ''}</button></div><div id="prev"></div></section>
      <div id="chk" style="display:flex;flex-direction:column;gap:10px"></div>
      <div class="btns"><button class="btn" data-a="copy" type="button">${ICONS.copy}Копировать</button><button class="btn pri" data-a="nc" type="button">Скачать .nc</button><button class="btn" data-a="txt" type="button">.txt</button></div>
      <div class="btns"><button class="btn sm" data-a="plot" type="button">${ICONS.eye}На эскизе</button><button class="btn sm" data-a="lib" type="button">В библиотеку</button></div>
      ${disclaimerHtml()}`;
    out();
  }

  const sync = () => { store.setBlocks(blocks); draw(); };
  root.addEventListener('input', (e) => {
    const k = e.target.dataset && e.target.dataset.o;
    if (!k) return;
    opts[k] = e.target.value;
    persist();
    out();
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-seg],[data-up],[data-down],[data-del],[data-clear],[data-num],[data-a]');
    if (!b) return;
    if (b.dataset.seg) { opts[b.dataset.seg] = b.dataset.v; persist(); draw(); }
    else if (b.dataset.up !== undefined) { const i = +b.dataset.up; if (i > 0) { [blocks[i - 1], blocks[i]] = [blocks[i], blocks[i - 1]]; sync(); } }
    else if (b.dataset.down !== undefined) { const i = +b.dataset.down; if (i < blocks.length - 1) { [blocks[i + 1], blocks[i]] = [blocks[i], blocks[i + 1]]; sync(); } }
    else if (b.dataset.del !== undefined) { blocks.splice(+b.dataset.del, 1); sync(); }
    else if (b.dataset.clear !== undefined) { if (window.confirm('Убрать все блоки?')) { blocks = []; sync(); } }
    else if (b.dataset.num !== undefined) { store.setSettings({ numbering: !s.numbering }); ctx.rerender(); }
    else if (b.dataset.a) {
      if (current.err || !current.lines.length) { toast('Исправьте ошибки шапки'); return; }
      const a = b.dataset.a;
      if (a === 'copy') copyText(current.lines.join('\n'));
      else if (a === 'nc' || a === 'txt') {
        const el = document.createElement('a');
        el.href = URL.createObjectURL(new Blob([toFileText(current.lines)], { type: 'text/plain' }));
        el.download = fileName(current.o.o, a);
        el.click();
        toast('Файл ' + el.download);
      } else if (a === 'plot') { store.save('bp', { lines: current.lines, profile: prof, from: 'program' }); location.hash = prof === 'MF' ? '#/backplotmf' : '#/backplot'; }
      else if (a === 'lib') {
        const it = newItem({ title: safeTitle(opts.title), o: 'O' + String(Math.round(current.o.o)).padStart(4, '0'), machine: prof, text: current.lines.join('\n') });
        libPut(it).then(() => toast('Сохранено в библиотеку')).catch(() => toast('Библиотека недоступна'));
      }
    }
  });
  draw();
}
export default { id: 'program', render };
