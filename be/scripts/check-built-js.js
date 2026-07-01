const fs = require('fs');
const content = fs.readFileSync('d:/TTSmartEcomWeb/ad/dist/assets/index-B8D6IKf6.js', 'utf8');
const count = (content.match(/superadmin/gi) || []).length;
console.log(`Word "superadmin" count (case-insensitive): ${count}`);
if (count > 0) {
  // Let's print some context around the match
  const idx = content.indexOf('superadmin');
  console.log('Context:', content.substring(Math.max(0, idx - 100), Math.min(content.length, idx + 100)));
}
process.exit(0);
