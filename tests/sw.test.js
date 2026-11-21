import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { assetList } from '../tools/sw-list.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('sw.js: список кэша актуален (node tools\sw-list.js) и все файлы существуют', () => {
  const sw = readFileSync(join(root, 'sw.js'), 'utf8');
  for (const a of assetList()) {
    assert.ok(sw.includes(`'${a}'`), 'нет в sw.js: ' + a);
    if (a !== './') assert.ok(existsSync(join(root, a)), 'нет файла: ' + a);
  }
});
test('манифест: имя, иконка, start_url', () => {
  const m = JSON.parse(readFileSync(join(root, 'manifest.webmanifest'), 'utf8'));
  assert.ok(m.name && m.icons.length && m.start_url);
});
