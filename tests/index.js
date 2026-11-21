// Точка входа для команды `node --test tests\` (Node 22+ не принимает каталог как аргумент).
// Подключает все tests\*.test.js в один процесс.
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
for (const f of readdirSync(dir).filter((n) => n.endsWith('.test.js')).sort()) {
  await import(pathToFileURL(join(dir, f)).href);
}
