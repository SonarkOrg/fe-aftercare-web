#!/usr/bin/env node
// Hard-coded string check and inventory for the staff UI (no dependencies, Node 18+).
//   node scripts/i18n-check.mjs              report findings, exit 1 if any
//   node scripts/i18n-check.mjs --inventory  print every finding as TSV and exit 0
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = path.join(root, 'src/app');
const inventory = process.argv.includes('--inventory');

const EXCLUDE = [
  /\.spec\.ts$/, /src\/app\/i18n\/dict\//, /src\/app\/testing\//, /src\/app\/components\/patient-questionnaire\//,
  /\.i18n\.ts$/, /src\/app\/auth\/dev-/, /staff-auth\.providers\.development\.ts$/, /src\/app\/fhir\/questionnaire-form\//
];
const BRAND = ['Aftercare', 'RAMQ', 'NAM', 'SMS', 'PDF', 'JPEG', 'PNG', 'SMTP', 'Twilio', 'Auth0', 'LOG', 'ICD-10', 'CIM-10', '°C', 'Français', 'English'];
// Words that are not translated stay out of this list: elements that carry a lang attribute (language names, the DEV AUTH chip) are skipped structurally.
const brandRe = new RegExp(`\\b(${BRAND.map(b => b.replace(/[-.]/g, '\\$&')).join('|')})\\b`, 'g');

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(html|ts)$/.test(f) && !EXCLUDE.some(r => r.test(p.replaceAll('\\', '/')))) out.push(p);
  }
  return out;
}

const findings = [];
function checkHtmlInline(file, html, startLine) {
  const before = findings.length;
  checkHtml(file, html);
  for (const f of findings.slice(before)) f.line += startLine - 1;
}
const add = (file, line, rule, text) => findings.push({ file: path.relative(root, file), line, rule, text: text.trim().replace(/\s+/g, ' ').slice(0, 100) });
const lineOf = (s, idx) => s.slice(0, idx).split('\n').length;

/** Quoted literals in a template expression that read as prose (a space, or a capitalised word) and are not piped through t / enumLabel. */
function proseLiterals(e) {
  return [...e.matchAll(/'([^']*[A-Za-zÀ-ÿ]{2,}[^']*)'/g)].filter(x => (/\s/.test(x[1]) || /^[A-ZÀ-Þ][a-zà-ÿ]/.test(x[1])) && !/^[a-z]+(\.[a-zA-Z0-9_]+)+$/.test(x[1])
    && !x[1].replace(brandRe, ' ').match(/^[^A-Za-zÀ-ÿ]*$/) && !/^\s*\|\s*(t|enumLabel)\b/.test(e.slice(x.index + x[0].length, x.index + x[0].length + 14)));
}

function checkHtml(file, s) {
  s = s.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));
  const lines = s.split('\n');
  const ignored = new Set();
  lines.forEach((l, i) => { if (/i18n-ignore/.test(l)) { ignored.add(i + 1); ignored.add(i + 2); } });
  // 1. text nodes
  const textRe = />([^<>]*)</g;
  let m;
  while ((m = textRe.exec(s))) {
    const t = m[1].replace(/\{\{[\s\S]*?\}\}/g, ' ').replace(/&[a-z]+;|&#\d+;/g, ' ').replace(brandRe, ' ');
    const openTag = s.slice(s.lastIndexOf('<', m.index), m.index + 1);
    const hasLang = /\slang=/.test(openTag);
    if (/[A-Za-zÀ-ÿ]{2,}/.test(t) && !hasLang) {
      const ln = lineOf(s, m.index + 1 + (m[1].length - m[1].trimStart().length));
      if (!ignored.has(ln)) add(file, ln, 'html-text', m[1]);
    }
  }
  // 1b. prose literals inside interpolations: {{ c ? 'Open' : 'Closed' }}, {{ 'Loading data' }}
  const interpRe = /\{\{([\s\S]*?)\}\}/g;
  while ((m = interpRe.exec(s))) {
    if (proseLiterals(m[1]).length && !ignored.has(lineOf(s, m.index))) add(file, lineOf(s, m.index), 'html-interp-literal', `{{${m[1]}}}`);
  }
  // 2. literal attributes
  const attrRe = /(?<![\w\[.-])(aria-label|title|placeholder|alt|aria-description|aria-placeholder|aria-valuetext|aria-roledescription|label)="([^"]*)"/g;
  while ((m = attrRe.exec(s))) {
    const t = m[2].replace(/\{\{[\s\S]*?\}\}/g, ' ').replace(brandRe, ' ');
    const tag = s.slice(s.lastIndexOf('<', m.index), m.index);
    if (/[A-Za-zÀ-ÿ]{2,}/.test(t) && !/\slang=/.test(tag) && !ignored.has(lineOf(s, m.index))) add(file, lineOf(s, m.index), 'html-attr', m[0]);
  }
  // 3. bound literals not followed by | t
  const boundRe = /\[(?:attr\.)?(aria-label|title|placeholder|alt|aria-description|aria-placeholder|aria-valuetext|aria-roledescription|label|question|confirmLabel|reasonLabel|sub)\]="([^"]*)"/g;
  while ((m = boundRe.exec(s))) {
    const e = m[2];
    // a literal with a space or a capital first letter is prose; bare identifiers ('all', 'HIGH', keys) are code
    const lits = [...e.matchAll(/'([^']*[A-Za-zÀ-ÿ]{2,}[^']*)'/g)].filter(x => (/\s/.test(x[1]) || /^[A-ZÀ-Þ][a-zà-ÿ]/.test(x[1])) && !/\|\s*(t|enumLabel)\b/.test(e.slice(x.index + x[0].length, x.index + x[0].length + 12)));
    if (lits.length && !ignored.has(lineOf(s, m.index))) add(file, lineOf(s, m.index), 'html-bound-literal', m[0]);
  }
  // 4. banned pipes
  const pipeRe = /\|\s*(date|number|percent|currency|titlecase|uppercase|lowercase|slice)\b(?!\s*\()/g;
  while ((m = pipeRe.exec(s))) if (m[1] !== 'slice') add(file, lineOf(s, m.index), 'banned-pipe', m[0]);
  // 6. humanize in templates
  const hRe = /humanize\(/g;
  while ((m = hRe.exec(s))) add(file, lineOf(s, m.index), 'humanize-display', 'humanize(');
}

function checkTs(file, s) {
  if (/i18n-ignore-file/.test(s.slice(0, 400))) return;
  // inline templates are templates too
  for (const m of s.matchAll(/template:\s*`([\s\S]*?)`/g)) {
    checkHtmlInline(file, m[1], lineOf(s, m.index));
  }
  const lines = s.replace(/template:\s*`[\s\S]*?`/g, m => m.replace(/[^\n]/g, ' ')).split('\n');
  const strRe = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
  lines.forEach((l, i) => {
    if (/^\s*(import|export \* from|\/\/|\*|\/\*)/.test(l) && !/^\s*export\b.*=/.test(l)) return;
    if (/i18n-ignore/.test(l) || (i > 0 && /i18n-ignore/.test(lines[i - 1]))) return;
    if (/console\.(log|warn|error|info)|throw new Error|import\(/.test(l)) return;
    let m;
    strRe.lastIndex = 0;
    const code = l.replace(/\s\/\/.*$/, '').replace(/\/\*.*?\*\//g, '');
    while ((m = strRe.exec(code))) {
      const t = m[2];
      // single-word UI literals in display props (label: 'Open', title: 'Close'), and words around ${} in template literals
      const prop = /(?:^|[\s{,(])(label|title|text|message|placeholder|heading|description|short|sub|aria\w*|tooltip|caption|hint)\s*:\s*$/.exec(code.slice(0, m.index));
      if (prop && /^[A-ZÀ-Þ]?[a-zà-ÿ]{2,}/.test(t.replace(brandRe, ' ').trim()) && /[A-Za-zÀ-ÿ]{2,}/.test(t.replace(brandRe, ' ')) && !/^\s*[a-z]+(\.[a-zA-Z0-9_]+)+\s*$/.test(t)) {
        add(file, i + 1, 'ts-literal', `${prop[1]}: ${m[0]}`);
        continue;
      }
      if (m[1] === '`' && /\}\s+[A-Za-zÀ-ÿ]{2,}|[A-Za-zÀ-ÿ]{2,}\s+\$\{/.test(t) && !/--|__/.test(t)) {
        add(file, i + 1, 'ts-literal', m[0]);
        continue;
      }
      if (/[\[\]()]/.test(t) && !/\s[a-z]+\s/.test(t) && !/^[A-Z]/.test(t)) continue; // selectors and template syntax
      if (/^[A-Z_]+$/.test(t) || /^[a-z]+(\.[a-zA-Z0-9_]+)+$/.test(t) || /^[\w./:@#?&=%${}\-+*~()[\]|,\\ ]*$/.test(t) && !/\s/.test(t)) continue;
      if (/^(https?:|\/|\.\.?\/|[A-Za-z0-9_-]+\.(css|html|ts))/.test(t) || /^[YyMmdHhsS\-:T\s.'EZ]+$/.test(t) && /[Yy]{2}|HH|mm/.test(t)) continue;
      const stripped = t.replace(brandRe, ' ');
      if (/^[A-Z][a-z]+(\s+[a-z'’]+){1,}/.test(stripped) || /\b(the|and|of|to|is|not|could|please|error|failed)\b/.test(stripped)) {
        if (/^\s*(selector|templateUrl|styleUrl|styles|template)\b/.test(l)) continue;
        add(file, i + 1, 'ts-literal', m[0]);
      }
    }
  });
}

// 7. dictionary chunks
function checkChunks(file, s) {
  const rel = path.relative(root, file).replaceAll('\\', '/');
  if (/i18n\.service\.ts$/.test(rel)) return;
  for (const m of s.matchAll(/^\s*import\s+(?!type)[^;]*['"][^'"]*dict\/core\.(fr|en)['"]/gm)) add(file, lineOf(s, m.index), 'dict-chunks', m[0]);
}

for (const f of walk(src)) {
  const s = readFileSync(f, 'utf8');
  if (f.endsWith('.html')) checkHtml(f, s);
  else { checkTs(f, s); checkChunks(f, s); }
}

// 8. scope: a key from a lazy dictionary (patientFile, pages) used outside its own module is missing at runtime; shared keys belong in core
const dictDir0 = path.join(src, 'i18n/dict');
const scopeOf = {};
for (const [file, scope] of [['core', 'core'], ['patient-file', 'patientFile'], ['pages', 'pages']]) {
  for (const m of readFileSync(path.join(dictDir0, `${file}.en.ts`), 'utf8').matchAll(/^\s*'([^']+)':/gm)) scopeOf[m[1]] = scope;
}
const fileScope = rel => /components\/(patient-file|patient-detail)\//.test(rel) ? 'patientFile' : /components\/(settings|reports|messages|pages\.module)|shared\/report\.util/.test(rel) ? 'pages' : 'core';
for (const f of walk(src)) {
  const rel = path.relative(root, f).replaceAll('\\', '/');
  const mine = fileScope(rel);
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/'([a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9_]+)+)'/g)) {
    const sc = scopeOf[m[1]];
    if (sc && sc !== 'core' && sc !== mine) add(f, lineOf(text, m.index), 'scope', `${m[1]} is in the ${sc} dictionary`);
  }
}

// Unused keys (a warning, never a failure): dictionary keys that no template or TS file mentions.
const dictDir = path.join(src, 'i18n/dict');
const keys = [];
for (const f of readdirSync(dictDir).filter(x => x.endsWith('.en.ts'))) {
  for (const m of readFileSync(path.join(dictDir, f), 'utf8').matchAll(/^\s*'([^']+)':/gm)) keys.push(m[1]);
}
const all = readdirSync(src, { recursive: true }).map(String).filter(f => /\.(ts|html)$/.test(f) && !/dict[\\/]/.test(f) && !/\.spec\.ts$/.test(f))
  .map(f => readFileSync(path.join(src, f), 'utf8')).join('\n');
const DYNAMIC = /^(enum|error|pd\.tab|pd\.notif\.(consent|lang)|sendLink\.channel|page|settings\.tab|chart\.status|forms\.outcome)\./;
const unused = keys.filter(k => !DYNAMIC.test(k) && !all.includes(`'${k}'`) && !all.includes(`"${k}"`) && !all.includes(`\`${k}\``));

if (inventory) {
  console.log('file\tline\trule\ttext');
  for (const f of findings) console.log(`${f.file}\t${f.line}\t${f.rule}\t${f.text}`);
  process.exit(0);
}
for (const f of findings) console.error(`${f.file}:${f.line}: ${f.rule}: ${f.text}`);
if (unused.length) console.warn(`warning: ${unused.length} dictionary key(s) never referenced: ${unused.slice(0, 15).join(', ')}${unused.length > 15 ? ', …' : ''}`);
console.log(findings.length ? `\n${findings.length} finding(s)` : 'i18n:check: 0 findings');
process.exit(findings.length ? 1 : 0);
