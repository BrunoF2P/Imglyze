import { execFileSync } from 'node:child_process';

const ref = process.argv[2] || execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim();
if (!ref || ref.startsWith('-')) throw new Error('Informe uma branch ou tag válida.');
execFileSync('git', ['check-ref-format', '--allow-onelevel', ref]);
execFileSync('git', ['rev-parse', '--verify', ref], { stdio: 'ignore' });
for (const remote of ['origin', 'github']) {
  console.log(`Enviando ${ref} para ${remote}…`);
  execFileSync('git', ['push', remote, ref], { stdio: 'inherit' });
}
