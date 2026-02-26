#!/usr/bin/env node
/**
 * OllamaBar Install Script
 * - Writes proxy_server/com.ollamabro.proxy.json with the correct absolute path
 * - Registers the Native Messaging Host in the Windows registry for Chrome (and Edge)
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const proxyDir = path.join(__dirname, 'proxy_server');
const batPath = path.join(proxyDir, 'native-host.bat');
const jsonPath = path.join(proxyDir, 'com.ollamabro.proxy.json');

// Verify the proxy server directory exists
if (!fs.existsSync(proxyDir)) {
  console.error('Error: proxy_server/ directory not found. Run this script from the repo root.');
  process.exit(1);
}

if (!fs.existsSync(batPath)) {
  console.error('Error: proxy_server/native-host.bat not found.');
  process.exit(1);
}

// Write the manifest with the correct absolute path
const manifest = {
  name: 'com.ollamabro.proxy',
  description: 'OllamaBro Proxy Server Manager',
  path: batPath,
  type: 'stdio',
  allowed_origins: [
    'chrome-extension://gkpfpdekobmonacdgjgbfehilnloaacm/'
  ]
};

fs.writeFileSync(jsonPath, JSON.stringify(manifest, null, 2));
console.log('✔ Wrote manifest:', jsonPath);

// Register in Windows registry
function registerBrowser(browserName, regPath) {
  const key = `${regPath}\\com.ollamabro.proxy`;
  try {
    execSync(`reg add "${key}" /ve /d "${jsonPath}" /f`, { stdio: 'pipe' });
    console.log(`✔ Registered for ${browserName}: ${key}`);
  } catch (e) {
    console.warn(`  Skipped ${browserName} (not installed or registry write failed): ${e.message.trim()}`);
  }
}

registerBrowser('Chrome', 'HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts');
registerBrowser('Edge',   'HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts');

console.log('\nInstallation complete!');
console.log('Next steps:');
console.log('  1. cd proxy_server && npm install');
console.log('  2. Load the chrome_extension/ folder as an unpacked extension in Chrome');
