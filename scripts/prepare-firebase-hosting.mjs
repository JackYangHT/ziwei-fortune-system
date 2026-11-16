import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'firebase-dist');

if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

// 1. Copy public/ assets
const publicDir = path.join(root, 'public');
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, distDir, { recursive: true });
}

// 2. Copy .next/static -> firebase-dist/_next/static
const nextStaticDir = path.join(root, '.next', 'static');
const targetStaticDir = path.join(distDir, '_next', 'static');
fs.mkdirSync(targetStaticDir, { recursive: true });
fs.cpSync(nextStaticDir, targetStaticDir, { recursive: true });

// 3. Copy prerendered .html and .txt/.body files from .next/server/app
const nextServerAppDir = path.join(root, '.next', 'server', 'app');
function copyAppFiles(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyAppFiles(srcPath, destPath);
    } else if (
      entry.name.endsWith('.html') ||
      entry.name.endsWith('.rsc') ||
      entry.name === 'robots.txt.body' ||
      entry.name === 'sitemap.xml.body'
    ) {
      if (entry.name === 'robots.txt.body') {
        fs.copyFileSync(srcPath, path.join(destDir, 'robots.txt'));
      } else if (entry.name === 'sitemap.xml.body') {
        fs.copyFileSync(srcPath, path.join(destDir, 'sitemap.xml'));
      } else if (entry.name === '_not-found.html') {
        fs.copyFileSync(srcPath, path.join(distDir, '404.html'));
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

copyAppFiles(nextServerAppDir, distDir);
console.log('✓ Prepared firebase-dist/ for Firebase Hosting deployment');
