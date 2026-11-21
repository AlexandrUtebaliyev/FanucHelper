import test from 'node:test';
import assert from 'node:assert/strict';
import { fmt, word, diaWord, translit, comment, parseNum, micro, arcCode } from '../js/gcode/format.js';

test('format: 25 -> X25.', () => assert.equal(word('X', 25), 'X25.'));
test('format: 25.1 -> X25.1', () => assert.equal(word('X', 25.1), 'X25.1'));
test('format: -0.0004 -> X0.', () => assert.equal(word('X', -0.0004), 'X0.'));
test('format: никогда не выводит -0.', () => {
  for (const n of [-0, -0.0004, -1e-9, -0.0000001]) assert.ok(!/-0\.?$/.test(fmt(n)), String(n) + ' -> ' + fmt(n));
  assert.equal(fmt(-0.0004), '0.');
});
test('format: хвостовые нули убираются, точка остаётся', () => {
  assert.equal(fmt(100), '100.');
  assert.equal(fmt(10.05), '10.05');
  assert.equal(fmt(12.3456), '12.346');
  assert.equal(fmt(12.3456, 2), '12.35');
  assert.equal(fmt(-5.5), '-5.5');
});
test('format: округление x.xxx5 вверх без сюрпризов float', () => {
  assert.equal(fmt(19.9895), '19.99');
  assert.equal(fmt(1.0005), '1.001');
});
test('format: диаметр из радиуса', () => assert.equal(diaWord('X', 12.5), 'X25.'));
test('format: NaN не молча, а ошибкой', () => assert.throws(() => fmt(NaN)));
test('format: микроны целые без точки', () => assert.equal(micro(1.5335), '1534'));
test('format: запятая как разделитель', () => {
  assert.equal(parseNum('1,5'), 1.5);
  assert.equal(parseNum(' 2.25 '), 2.25);
  assert.ok(Number.isNaN(parseNum('')));
});
test('translit: «ВАЛ 1» -> (VAL 1)', () => assert.equal(comment('ВАЛ 1'), '(VAL 1)'));
test('translit: только латиница, цифры, пробелы', () => {
  assert.equal(translit('Вал-12 (черн.)'), 'VAL 12 CHERN');
  assert.equal(translit('Щётка'), 'SCHETKA');
  assert.match(comment('Проходной, Ø30!'), /^\([A-Z0-9 ]+\)$/);
});
test('arcCode: задний держатель — против часовой G03, передний зеркально', () => {
  assert.equal(arcCode(true, 'rear'), 'G03');
  assert.equal(arcCode(false, 'rear'), 'G02');
  assert.equal(arcCode(true, 'front'), 'G02');
});
