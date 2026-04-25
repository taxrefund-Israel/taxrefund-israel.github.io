/**
 * build.js — Obfuscate inline JS blocks in index.html
 * Obfuscates only the "Main App" and "Accessibility widget JS" script blocks.
 * Leaves GA, AdSense, and redirect scripts untouched.
 */

const fs   = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

const SRC  = path.join(__dirname, 'index.html');
const DIST = path.join(__dirname, 'index.html'); // overwrite in-place (CI works on a checkout copy)

const OBFUSCATE_MARKERS = [
  '<!-- ── Accessibility widget JS ── -->',
  '<!-- ── Main App ── -->'
];

const OBF_OPTIONS = {
  compact: true,
  controlFlowFlattening: false,   // keep false — too slow + breaks some logic
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,           // keep false — avoids breaking window globals
  selfDefending: false,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  transformObjectKeys: false,
  unicodeEscapeSequence: false
};

let html = fs.readFileSync(SRC, 'utf8');
let count = 0;

for (const marker of OBFUSCATE_MARKERS) {
  // Match: marker, optional whitespace/newlines, <script>, content, </script>
  const regex = new RegExp(
    '(' + escapeRegex(marker) + '\\s*<script>)([\\s\\S]*?)(<\\/script>)',
    'g'
  );

  html = html.replace(regex, (full, open, code, close) => {
    try {
      const result = JavaScriptObfuscator.obfuscate(code, OBF_OPTIONS);
      count++;
      console.log(`✅ Obfuscated block after: ${marker.slice(0, 40)}...`);
      return open + result.getObfuscatedCode() + close;
    } catch (err) {
      console.error(`❌ Failed to obfuscate block after: ${marker}\n`, err.message);
      process.exit(1);
    }
  });
}

fs.writeFileSync(DIST, html, 'utf8');
console.log(`\n🔒 Done — ${count} block(s) obfuscated → ${DIST}`);

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
