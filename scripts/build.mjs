/**
 * Napaxtime production build — copies static assets to dist/ for deployment.
 * No bundler: preserves ES modules and existing architecture.
 */
import { cpSync, mkdirSync, rmSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');

const COPY_PATHS = [
  'index.html',
  'manifest.json',
  'robots.txt',
  'sitemap.xml',
  'css',
  'js',
  'assets',
];

function copyRecursive(src, dest) {
  cpSync(src, dest, { recursive: true });
}

function validateRequiredFiles() {
  const required = ['index.html', 'js/app.js', 'js/features.js', 'js/storage.js', 'js/utils.js', 'css/additions.css'];
  const missing = required.filter((p) => {
    try {
      statSync(join(root, p));
      return false;
    } catch {
      return true;
    }
  });
  if (missing.length) {
    throw new Error(`Build failed — missing required files:\n  ${missing.join('\n  ')}`);
  }
}

function injectBuildMeta() {
  const htmlPath = join(dist, 'index.html');
  let html = readFileSync(htmlPath, 'utf8');
  const stamp = new Date().toISOString();
  const meta = `<meta name="napaxtime-build" content="${stamp}" />`;
  if (!html.includes('name="napaxtime-build"')) {
    html = html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    ${meta}`);
    writeFileSync(htmlPath, html, 'utf8');
  }
}

console.log('Napaxtime build starting…');
validateRequiredFiles();

try {
  rmSync(dist, { recursive: true, force: true });
} catch {
  /* dist may not exist */
}
mkdirSync(dist, { recursive: true });

COPY_PATHS.forEach((item) => {
  const src = join(root, item);
  try {
    statSync(src);
    copyRecursive(src, join(dist, item));
    console.log(`  copied ${item}`);
  } catch {
    console.warn(`  skipped ${item} (not found)`);
  }
});

injectBuildMeta();
console.log('Napaxtime build complete → dist/');
