import { readFileSync } from 'node:fs';

const tag = process.argv[2] || process.env.CI_COMMIT_TAG ||
  (process.env.GITHUB_REF_TYPE === 'tag' ? process.env.GITHUB_REF_NAME : '');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const tauri = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const cargo = readFileSync('src-tauri/Cargo.toml', 'utf8');
const cargoVersion = cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
if (pkg.version !== tauri.version || pkg.version !== cargoVersion) {
  throw new Error('As versões de package.json, Cargo.toml e tauri.conf.json precisam coincidir.');
}
if (tag && (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag) || tag !== `v${pkg.version}`)) {
  throw new Error(`A tag deve corresponder à versão do aplicativo: v${pkg.version}`);
}
console.log(`Versões consistentes: ${pkg.version}${tag ? ` (${tag})` : ''}`);
