import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

// Все модули ui\ и profiles\ должны загружаться без DOM и иметь default-экспорт.
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'js');
for (const sub of ['ui', 'profiles']) {
  for (const f of readdirSync(join(root, sub)).filter((n) => n.endsWith('.js'))) {
    test(`smoke: js/${sub}/${f} загружается`, async () => {
      const m = await import(pathToFileURL(join(root, sub, f)).href);
      assert.ok(Object.keys(m).length > 0);
    });
  }
}
