import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const platform = process.platform;
const universal = platform === 'darwin';
const root = resolve(import.meta.dirname, '..');
const run = (command, args, env = process.env) => {
  const result = spawnSync(command, args, { cwd: root, env, stdio: 'inherit', shell: platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};
const required = names => {
  const missing = names.filter(name => !process.env[name]);
  if (missing.length) throw new Error(`Release signing requires: ${missing.join(', ')}`);
};
const config = { bundle: {} };
const releaseTag = process.env.CI_COMMIT_TAG ||
  (process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : '');
run(process.execPath, ['scripts/check-release.mjs', releaseTag]);
if (releaseTag) {
  const requireSigning = process.env.RELEASE_REQUIRE_SIGNING === 'true';
  if (platform === 'win32') {
    if (requireSigning) required(['WINDOWS_CERTIFICATE_THUMBPRINT']);
    if (process.env.WINDOWS_CERTIFICATE_THUMBPRINT) {
      config.bundle.windows = {
        certificateThumbprint: process.env.WINDOWS_CERTIFICATE_THUMBPRINT,
        digestAlgorithm: 'sha256', timestampUrl: 'http://timestamp.digicert.com'
      };
    } else {
      console.warn('Windows: instaladores sem assinatura de publicador.');
    }
  } else if (universal) {
    const appleSecrets = ['APPLE_CERTIFICATE', 'APPLE_CERTIFICATE_PASSWORD', 'APPLE_SIGNING_IDENTITY',
      'APPLE_ID', 'APPLE_PASSWORD', 'APPLE_TEAM_ID'];
    if (requireSigning || appleSecrets.some(name => process.env[name])) {
      required(appleSecrets);
      config.bundle.macOS = { signingIdentity: process.env.APPLE_SIGNING_IDENTITY };
    } else {
      config.bundle.macOS = { signingIdentity: '-' };
      console.warn('macOS: assinatura ad hoc, sem notarização Apple.');
    }
  }
}
run(platform === 'win32' ? 'python' : 'python3', ['scripts/build-dav1d.py', ...(universal ? ['--universal'] : [])]);
const env = { ...process.env, SYSTEM_DEPS_DAV1D_LINK: 'static', SYSTEM_DEPS_DAV1D_BUILD_INTERNAL: 'never',
  PKG_CONFIG_PATH: resolve(root, '.build/dav1d/install/lib/pkgconfig') };
mkdirSync(resolve(root, '.build'), { recursive: true });
const configPath = resolve(root, '.build/release-config.json');
writeFileSync(configPath, JSON.stringify(config));
run('npm', ['run', 'tauri', '--', 'build', '--config', configPath,
  '--bundles', platform === 'win32' ? 'msi,nsis' : universal ? 'dmg' : 'appimage,deb,rpm',
  ...(universal ? ['--target', 'universal-apple-darwin'] : [])], env);
