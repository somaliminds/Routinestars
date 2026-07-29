#!/usr/bin/env node
/**
 * check-locales.mjs — structural verification of the i18n locale files.
 *
 * Every non-English locale must have EXACTLY the same keys as en.json (the
 * source of truth), no blank values, and identical {{placeholders}} per key.
 * This catches a translator dropping a key, adding a stray one, leaving a
 * string blank, or mangling an interpolation placeholder — the mechanical
 * errors. It does NOT check linguistic accuracy (that needs a native review).
 *
 * Usage: node scripts/check-locales.mjs   (exit 1 on any problem)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');
const flat = (o, p = '', r = {}) => {
  for (const [k, v] of Object.entries(o)) {
    const key = p ? `${p}.${k}` : k;
    if (v && typeof v === 'object') flat(v, key, r);
    else r[key] = v;
  }
  return r;
};
const placeholders = (s) =>
  [...String(s).matchAll(/\{\{[^}]+\}\}/g)]
    .map((m) => m[0])
    .sort()
    .join(',');

const en = flat(JSON.parse(fs.readFileSync(path.join(dir, 'en.json'), 'utf8')));
const enKeys = Object.keys(en).sort();
let ok = true;

for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'en.json')) {
  const lang = file.replace('.json', '');
  let loc;
  try {
    loc = flat(JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')));
  } catch (e) {
    console.log(`❌ ${lang}: invalid JSON — ${e.message}`);
    ok = false;
    continue;
  }
  const keys = Object.keys(loc);
  const missing = enKeys.filter((k) => !(k in loc));
  const extra = keys.filter((k) => !(k in en));
  const phMismatch = enKeys.filter((k) => k in loc && placeholders(en[k]) !== placeholders(loc[k]));
  const blank = keys.filter((k) => !String(loc[k]).trim());
  const clean = !missing.length && !extra.length && !phMismatch.length && !blank.length;
  ok = ok && clean;
  console.log(
    `${clean ? '✅' : '❌'} ${lang}: ${keys.length}/${enKeys.length} keys` +
      (missing.length ? ` | MISSING ${missing.join(',')}` : '') +
      (extra.length ? ` | EXTRA ${extra.join(',')}` : '') +
      (phMismatch.length ? ` | PLACEHOLDER MISMATCH ${phMismatch.join(',')}` : '') +
      (blank.length ? ` | BLANK ${blank.join(',')}` : ''),
  );
}

console.log(ok ? '\nAll locales structurally valid.' : '\nProblems found.');
process.exit(ok ? 0 : 1);
