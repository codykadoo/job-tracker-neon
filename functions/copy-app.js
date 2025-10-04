const fs = require('fs');
const path = require('path');

const filesToCopy = [
  'server.js',
  'firebaseAdmin.js',
  'firestoreData.js'
];

const srcRoot = path.resolve(__dirname, '..');
const destRoot = __dirname;

filesToCopy.forEach((file) => {
  const src = path.join(srcRoot, file);
  const dest = path.join(destRoot, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} -> functions/${file}`);
  } else {
    console.warn(`Source not found: ${src}`);
  }
});

console.log('Copy completed.');