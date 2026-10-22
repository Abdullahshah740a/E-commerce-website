import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const files = readdirSync('supabase/migrations')
  .filter((f) => f.endsWith('.sql'))
  .sort();
const sql = [
  '-- Fresh installations only. Run once in Supabase SQL Editor.',
  '-- Do not run this bundle if any store migration has already been applied.',
  'begin;',
  ...files.map((file) => `\n-- ${file}\n${readFileSync(`supabase/migrations/${file}`, 'utf8')}`),
  'commit;',
  '',
].join('\n');
writeFileSync('supabase/setup.sql', sql);
console.log(`Bundled ${files.length} migrations into supabase/setup.sql`);
