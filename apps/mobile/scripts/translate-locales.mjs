#!/usr/bin/env node
/**
 * translate-locales.mjs — machine-translate the English base locale into the
 * other supported UI languages via the Google Cloud Translation API (v2).
 *
 * Scope: app navigation/UI chrome only. The EHCP/SEND report CONTENT is NOT in
 * these files (it stays English by decision), so this never machine-translates
 * statutory/medical copy.
 *
 * Usage:
 *   GOOGLE_TRANSLATE_API_KEY=xxx node scripts/translate-locales.mjs
 *   GOOGLE_TRANSLATE_API_KEY=xxx node scripts/translate-locales.mjs --only so,pl
 *   node scripts/translate-locales.mjs --dry     # counts characters, no API calls
 *
 * Behaviour:
 *   - Reads src/i18n/locales/en.json (nested).
 *   - INCREMENTAL: only translates keys missing from an existing target file,
 *     so re-runs after adding English strings cost only the new keys.
 *   - Preserves i18next interpolation placeholders ({{name}}) — they are masked
 *     before translation and restored after, so Google never mangles them.
 *   - Writes src/i18n/locales/<lang>.json.
 *
 * Cost: the whole app chrome is ~tens of thousands of characters; all languages
 * once is well within Google's free tier. Review the EHCP-adjacent / consent
 * strings with a native speaker before shipping (see docs/I18N.md).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const TARGETS = { so: 'so', pl: 'pl', ur: 'ur', cy: 'cy', ar: 'ar', pa: 'pa', bn: 'bn' };

const args = process.argv.slice(2);
const dry = args.includes('--dry');
const onlyArg = args.find((a) => a === '--only');
const only = onlyArg ? args[args.indexOf('--only') + 1]?.split(',') : null;
const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;

// ── flatten / unflatten nested JSON ──────────────────────────────────────────
const flatten = (obj, prefix = '', out = {}) => {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
};
const unflatten = (flat) => {
  const out = {};
  for (const [key, val] of Object.entries(flat)) {
    const parts = key.split('.');
    let node = out;
    parts.forEach((p, i) => {
      if (i === parts.length - 1) node[p] = val;
      else node = node[p] ??= {};
    });
  }
  return out;
};

// ── placeholder masking so {{name}} survives translation ─────────────────────
const mask = (s) => {
  const holders = [];
  const masked = s.replace(/\{\{[^}]+\}\}/g, (m) => {
    holders.push(m);
    return `${holders.length - 1}`;
  });
  return { masked, holders };
};
const unmask = (s, holders) =>
  s.replace(/(\d+)/g, (_, i) => holders[Number(i)] ?? '');

async function googleTranslate(texts, target) {
  const res = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: texts, target, format: 'text', source: 'en' }),
    },
  );
  if (!res.ok) throw new Error(`Google API ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return json.data.translations.map((t) => t.translatedText);
}

async function run() {
  const en = flatten(JSON.parse(fs.readFileSync(path.join(LOCALES, 'en.json'), 'utf8')));
  const langs = Object.keys(TARGETS).filter((l) => !only || only.includes(l));
  let totalChars = 0;

  for (const lang of langs) {
    const file = path.join(LOCALES, `${lang}.json`);
    const existing = fs.existsSync(file) ? flatten(JSON.parse(fs.readFileSync(file, 'utf8'))) : {};
    const missing = Object.keys(en).filter((k) => !(k in existing));
    if (missing.length === 0) {
      console.log(`${lang}: up to date (${Object.keys(en).length} keys)`);
      continue;
    }
    const chars = missing.reduce((n, k) => n + String(en[k]).length, 0);
    totalChars += chars;
    console.log(`${lang}: ${missing.length} new keys, ${chars} chars`);
    if (dry) continue;
    if (!apiKey) throw new Error('GOOGLE_TRANSLATE_API_KEY not set (use --dry to count only)');

    const masked = missing.map((k) => mask(String(en[k])));
    // Batch of 100 per request (Google limit is generous).
    const out = { ...existing };
    for (let i = 0; i < masked.length; i += 100) {
      const batch = masked.slice(i, i + 100);
      const translated = await googleTranslate(
        batch.map((b) => b.masked),
        TARGETS[lang],
      );
      translated.forEach((tr, j) => {
        out[missing[i + j]] = unmask(tr, batch[j].holders);
      });
    }
    fs.writeFileSync(file, JSON.stringify(unflatten(out), null, 2) + '\n', 'utf8');
    console.log(`  → wrote ${file}`);
  }
  console.log(`\nTotal characters this run: ${totalChars.toLocaleString()}`);
}

run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
