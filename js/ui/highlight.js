// Подсветка G-кода. Цвета — в css/app.css (.g .m .a .f .p .v .n .c).
export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const RE = /(\([^)]*\))|(\bN\d+)|(#\d+|#\[[^\]]*\])|\b(WHILE|DO\d*|END\d*|IF|GOTO|THEN)\b|\b([A-Z]{2,})\b|([A-Z])(-?[\d.]*)/g;

export function classOfLetter(L) {
  if (L === 'G') return 'g';
  if (L === 'M') return 'm';
  if ('XYZUWIJR'.includes(L)) return 'a';
  if ('FST'.includes(L)) return 'f';
  if ('PQHADK'.includes(L)) return 'p';
  return '';
}

export function highlightLine(line) {
  let out = '';
  let last = 0;
  line.replace(RE, (m, com, n, v, kw, word, L, num, idx) => {
    out += esc(line.slice(last, idx));
    last = idx + m.length;
    if (com) out += `<span class="c">${esc(m)}</span>`;
    else if (n) out += `<span class="n">${esc(m)}</span>`;
    else if (v) out += `<span class="v">${esc(m)}</span>`;
    else if (kw) out += `<span class="g">${esc(m)}</span>`;
    else if (word) out += esc(m);
    else {
      const c = classOfLetter(L);
      out += c ? `<span class="${c}">${esc(m)}</span>` : esc(m);
    }
    return m;
  });
  return out + esc(line.slice(last));
}

export const highlight = (lines) => (Array.isArray(lines) ? lines : String(lines).split('\n')).map((l) => `<div>${highlightLine(l) || ' '}</div>`).join('');
