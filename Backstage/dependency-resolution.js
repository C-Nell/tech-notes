function autoInstallDependencies(pluginPath) {
  const { execSync } = require('child_process');
  const fs = require('fs');
  const path = require('path');
  
  // Get all imports from TypeScript files
  const files = require('glob').sync('**/*.{ts,tsx}', { 
    cwd: pluginPath,
    ignore: ['**/node_modules/**', '**/dist/**']
  });
  
  const imports = new Set();
  files.forEach(file => {
    const content = fs.readFileSync(path.join(pluginPath, file), 'utf8');
    const matches = content.match(/from ['"]([^./][^'"]*)['"]/g) || [];
    
    matches.forEach(match => {
      const pkg = match.match(/from ['"]([^'"]+)['"]/)[1];
      const packageName = pkg.startsWith('@') 
        ? pkg.split('/').slice(0, 2).join('/') 
        : pkg.split('/')[0];
      imports.add(packageName);
    });
  });
  
  // Get existing dependencies
  const packageJson = JSON.parse(fs.readFileSync(path.join(pluginPath, 'package.json')));
  const existing = new Set(Object.keys({
    ...packageJson.dependencies,
    ...packageJson.devDependencies,
    ...packageJson.peerDependencies
  }));
  
  // Install missing
  const missing = Array.from(imports).filter(pkg => !existing.has(pkg));
  
  if (missing.length > 0) {
    console.log(`Installing ${missing.length} missing dependencies...`);
    execSync(`yarn add ${missing.join(' ')}`, { cwd: pluginPath, stdio: 'inherit' });
  }
}
