import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const check = tag => spawnSync(process.execPath, ['scripts/check-release.mjs', tag], { encoding: 'utf8' });
test('aceita uma tag correspondente à versão do aplicativo', () => {
  assert.equal(check(`v${version}`).status, 0);
});
test('recusa uma tag divergente antes de empacotar', () => {
  assert.notEqual(check('v999.0.0').status, 0);
});
test('recusa tags sem o prefixo de versão', () => {
  assert.notEqual(check(version).status, 0);
});
