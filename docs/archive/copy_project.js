const fs = require('fs');
const path = require('path');

const src = 'G:\\Agent_Project\\task-manage-sys';
const dest = 'G:\\Trea_Project';

const exclude = new Set(['node_modules', '.next', 'dev.db']);

function copyDir(srcDir, destDir) {
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (exclude.has(entry.name)) continue;

    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log('Copied: ' + path.relative(src, destPath));
    }
  }
}

console.log('Copying from: ' + src);
console.log('Copying to:   ' + dest);
copyDir(src, dest);
console.log('Done!');
