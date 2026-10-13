import test from 'node:test';
import assert from 'node:assert/strict';
import { appleSecrets, withoutEmptyAppleSecrets } from '../release-env.mjs';

test('omits empty Apple secrets so Tauri does not import an empty certificate', () => {
  const env = Object.fromEntries(appleSecrets.map(name => [name, '']));
  assert.deepEqual(withoutEmptyAppleSecrets(env), {});
  assert.equal(env.APPLE_CERTIFICATE, '');
});

test('preserves configured signing credentials and unrelated variables', () => {
  const env = { APPLE_CERTIFICATE: 'certificate', APPLE_CERTIFICATE_PASSWORD: 'password',
    APPLE_SIGNING_IDENTITY: 'identity', APPLE_ID: 'account', APPLE_PASSWORD: 'app-password',
    APPLE_TEAM_ID: 'team', PATH: '/usr/bin', OTHER: '' };
  assert.deepEqual(withoutEmptyAppleSecrets(env), env);
});
