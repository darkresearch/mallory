const fs = require('fs');
const path = require('path');

// Fix lightningcss for M1 Macs
const lightningcssPath = path.join(__dirname, '..', 'node_modules', 'lightningcss');

if (fs.existsSync(lightningcssPath)) {
  const indexPath = path.join(lightningcssPath, 'node', 'index.js');
  
  if (fs.existsSync(indexPath)) {
    let content = fs.readFileSync(indexPath, 'utf8');
    
    // Replace x64 with arm64 for Darwin
    content = content.replace(/darwin-x64/g, 'darwin-arm64');
    
    fs.writeFileSync(indexPath, content);
    console.log('✅ Fixed lightningcss for ARM64 (M1 Mac)');
  }
}
