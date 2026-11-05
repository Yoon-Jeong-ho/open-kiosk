import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const files = [];
for (const dir of ['src', 'public/js', 'scripts', 'tests']) for (const f of await readdir(dir)) if (/\.(mjs|js)$/.test(f)) files.push(`${dir}/${f}`);
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status) { process.stderr.write(result.stderr); process.exit(result.status); }
  const content = await readFile(file, 'utf8');
  assert.ok(!/sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{30,}/.test(content), `Possible credential in ${file}`);
}
for (const file of ['package.json']) JSON.parse(await readFile(file, 'utf8'));
const example = await readFile('.env.example', 'utf8');
assert.match(example, /^OPENAI_API_KEY=$/m);
console.log(`Syntax and credential-pattern checks passed for ${files.length} JavaScript files.`);
