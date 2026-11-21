// Обновляет список ASSETS в sw.js по файлам проекта (запуск: node tools\sw-list.js).
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['tests', 'design', 'tools', 'node_modules', '.git']);
const EXT = /\.(js|css|html|svg|webmanifest|json|png)$/;

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (SKIP.has(n)) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (EXT.test(n) && n !== 'sw.js' && n !== 'package.json') out.push('./' + relative(root, p).split('\\').join('/'));
  }
  return out;
}

export function assetList() { return ['./', ...walk(root).sort()]; }

if (process.argv[1] && process.argv[1].endsWith('sw-list.js')) {
  const sw = readFileSync(join(root, 'sw.js'), 'utf8');
  const list = assetList();
  const body = 'const ASSETS = [\n' + list.map((a) => `  '${a}',`).join('\n') + '\n];';
  const next = sw.replace(/const ASSETS = \[[\s\S]*?\];/, body).replace(/const CACHE = 'fh-v[^']*'/, `const CACHE = 'fh-v${Date.now().toString(36)}'`);
  writeFileSync(join(root, 'sw.js'), next);
  console.log('sw.js: ' + list.length + ' файлов');
}
