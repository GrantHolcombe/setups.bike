#!/usr/bin/env node
// Generates the database diagram in docs/DATABASE.md from db/schema.sql.
//
//   npm run db:diagram
//
// Run it after every migration, right after re-dumping db/schema.sql. It rewrites only the
// part of DATABASE.md between the GENERATED markers; the notes around it are hand-written.
// The diagram is Mermaid, which GitHub renders as a picture.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SCHEMA = path.join(ROOT, 'db', 'schema.sql');
const DOC = path.join(ROOT, 'docs', 'DATABASE.md');
const START = '<!-- GENERATED:START (npm run db:diagram) -->';
const END = '<!-- GENERATED:END -->';

const sql = fs.readFileSync(SCHEMA, 'utf8').replace(/\r\n/g, '\n');

// short type names that Mermaid accepts (no spaces or parentheses)
const shortType = (t) => t
  .replace(/character varying\((\d+)\)/, 'varchar_$1')
  .replace(/character varying/, 'varchar')
  .replace(/timestamp with time zone/, 'timestamptz')
  .replace(/timestamp without time zone/, 'timestamp')
  .replace(/double precision/, 'double')
  .replace(/[^A-Za-z0-9_]/g, '_');

// tables and their columns
const tables = {};
for (const m of sql.matchAll(/CREATE TABLE public\.(\w+) \(\n([\s\S]*?)\n\);/g)) {
  const cols = [];
  for (const line of m[2].split('\n')) {
    const l = line.trim().replace(/,$/, '');
    if (!l || l.startsWith('CONSTRAINT')) continue;
    const c = l.match(/^(\w+) (.+?)( DEFAULT .+?)?( NOT NULL)?$/);
    if (!c) continue;
    cols.push({ name: c[1], type: shortType(c[2].replace(/ GENERATED .*$/, '')), notNull: !!c[4] });
  }
  tables[m[1]] = { cols, pk: new Set(), uk: new Set(), fk: new Set() };
}

// keys
for (const m of sql.matchAll(/ALTER TABLE ONLY public\.(\w+)\n\s+ADD CONSTRAINT \w+ (PRIMARY KEY|UNIQUE) \(([^)]+)\)/g)) {
  const t = tables[m[1]];
  if (!t) continue;
  for (const col of m[3].split(',').map((s) => s.trim())) (m[2] === 'UNIQUE' ? t.uk : t.pk).add(col);
}
const rels = [];
for (const m of sql.matchAll(/ALTER TABLE ONLY public\.(\w+)\n\s+ADD CONSTRAINT \w+ FOREIGN KEY \((\w+)\) REFERENCES public\.(\w+)\((\w+)\)([^;]*);/g)) {
  const [, from, col, to, toCol, rest] = m;
  if (tables[from]) tables[from].fk.add(col);
  const onDelete = (rest.match(/ON DELETE (CASCADE|SET NULL|RESTRICT)/) || [])[1];
  const fromCol = tables[from] && tables[from].cols.find((c) => c.name === col);
  rels.push({ from, col, to, toCol, onDelete, optional: !(fromCol && fromCol.notNull) });
}

// Mermaid: parent ||--o{ child  (a nullable foreign key is drawn as zero-or-one on the parent side)
const lines = ['```mermaid', 'erDiagram'];
for (const r of rels) {
  const parentSide = r.optional ? '|o' : '||';
  const label = `${r.col}${r.onDelete ? ` (on delete ${r.onDelete.toLowerCase()})` : ''}`;
  lines.push(`  ${r.to} ${parentSide}--o{ ${r.from} : "${label}"`);
}
for (const [name, t] of Object.entries(tables)) {
  lines.push(`  ${name} {`);
  for (const c of t.cols) {
    const keys = [t.pk.has(c.name) && 'PK', t.fk.has(c.name) && 'FK', t.uk.has(c.name) && 'UK'].filter(Boolean).join(',');
    lines.push(`    ${c.type} ${c.name}${keys ? ' ' + keys : ''}${c.notNull ? '' : ' "nullable"'}`);
  }
  lines.push('  }');
}
lines.push('```');

const triggers = [...sql.matchAll(/CREATE TRIGGER (\w+) (AFTER|BEFORE) (\w+) ON public\.(\w+) .*EXECUTE FUNCTION public\.(\w+)\(\)/g)]
  .map((m) => `- \`${m[1]}\`: ${m[2].toLowerCase()} ${m[3].toLowerCase()} on \`${m[4]}\`, runs \`${m[5]}()\``);
const indexes = [...sql.matchAll(/CREATE (UNIQUE )?INDEX (\w+) ON public\.(\w+) USING \w+ \((.+)\);/g)]
  .map((m) => `- \`${m[2]}\` on \`${m[3]}\` (${m[4]})${m[1] ? ', unique' : ''}`);

const generated = [
  START,
  `_Generated from \`db/schema.sql\`. ${Object.keys(tables).length} tables, ${rels.length} foreign keys._`,
  '',
  ...lines,
  '',
  '**Triggers**',
  ...(triggers.length ? triggers : ['- none']),
  '',
  '**Extra indexes** (besides primary keys and unique constraints)',
  ...(indexes.length ? indexes : ['- none']),
  END,
].join('\n');

let doc = fs.readFileSync(DOC, 'utf8').replace(/\r\n/g, '\n');
if (!doc.includes(START) || !doc.includes(END)) throw new Error(`Missing GENERATED markers in ${DOC}`);
doc = doc.slice(0, doc.indexOf(START)) + generated + doc.slice(doc.indexOf(END) + END.length);
fs.writeFileSync(DOC, doc);
console.log(`docs/DATABASE.md: ${Object.keys(tables).length} tables, ${rels.length} relationships`);
