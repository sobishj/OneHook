import fs from 'fs';

// Verify all files exist
const files = [
  'public/manifest.json',
  'public/sw.js',
  'public/favicon.ico',
  'public/assets/favicon.svg',
  'public/assets/icon-192.png',
  'public/assets/icon-512.png',
  'public/assets/icon-maskable-512.png',
  'public/assets/apple-touch-icon.png'
];

let allOk = true;
for (const file of files) {
  if (fs.existsSync(file)) {
    const stat = fs.statSync(file);
    console.log(`[OK] ${file} (${stat.size} bytes)`);
  } else {
    console.error(`[FAIL] Missing: ${file}`);
    allOk = false;
  }
}

// Validate manifest.json content
const manifest = JSON.parse(fs.readFileSync('public/manifest.json', 'utf8'));
console.log('\nManifest Validation:');
console.log('- name:', manifest.name);
console.log('- short_name:', manifest.short_name);
console.log('- start_url:', manifest.start_url);
console.log('- display:', manifest.display);
console.log('- theme_color:', manifest.theme_color);
console.log('- icons count:', manifest.icons.length);

for (const icon of manifest.icons) {
  const iconPath = 'public' + icon.src;
  if (fs.existsSync(iconPath)) {
    console.log(`  - Icon ${icon.sizes} (${icon.purpose}): OK (${iconPath})`);
  } else {
    console.error(`  - Icon ${icon.sizes} MISSING: ${iconPath}`);
    allOk = false;
  }
}

if (allOk) {
  console.log('\nAll PWA assets verified successfully.');
} else {
  process.exit(1);
}
