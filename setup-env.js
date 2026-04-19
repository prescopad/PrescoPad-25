#!/usr/bin/env node

/**
 * PrescoPad Environment Configuration Helper
 *
 * This script helps configure the frontend API baseUrl
 * for different development scenarios (emulator vs physical device)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Get network interfaces
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal (i.e. 127.0.0.1) and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          name,
          address: iface.address,
        });
      }
    }
  }

  return addresses;
}

// Update config file
function updateConfig(ipAddress) {
  const configPath = path.join(__dirname, 'frontend', 'src', 'constants', 'config.ts');

  if (!fs.existsSync(configPath)) {
    console.error('❌ Config file not found:', configPath);
    process.exit(1);
  }

  let config = fs.readFileSync(configPath, 'utf8');

  // Replace baseUrl
  const newBaseUrl = ipAddress === 'localhost'
    ? 'http://localhost:3000/api'
    : `http://${ipAddress}:3000/api`;

  config = config.replace(
    /baseUrl:\s*['"]http:\/\/[^'"]+['"]/,
    `baseUrl: '${newBaseUrl}'`
  );

  fs.writeFileSync(configPath, config, 'utf8');

  console.log('✅ Configuration updated successfully!');
  console.log(`📡 API Base URL: ${newBaseUrl}`);
}

// Main
console.log('🔧 PrescoPad Environment Configuration Helper\n');

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage:');
  console.log('  node setup-env.js <option>\n');
  console.log('Options:');
  console.log('  emulator       - Configure for Android/iOS emulator (localhost)');
  console.log('  device         - Configure for physical device (auto-detect IP)');
  console.log('  <IP_ADDRESS>   - Configure with specific IP address\n');

  const localIPs = getLocalIPAddress();
  if (localIPs.length > 0) {
    console.log('Available network interfaces:');
    localIPs.forEach(({ name, address }) => {
      console.log(`  ${name}: ${address}`);
    });
  }

  process.exit(0);
}

const option = args[0].toLowerCase();

if (option === 'emulator') {
  console.log('⚙️  Configuring for emulator...\n');
  updateConfig('localhost');
} else if (option === 'device') {
  console.log('⚙️  Configuring for physical device...\n');

  const localIPs = getLocalIPAddress();

  if (localIPs.length === 0) {
    console.error('❌ No network interfaces found');
    console.error('💡 Make sure you\'re connected to WiFi');
    process.exit(1);
  }

  console.log('Available network interfaces:');
  localIPs.forEach(({ name, address }, index) => {
    console.log(`  ${index + 1}. ${name}: ${address}`);
  });

  // Use the first interface (usually WiFi)
  const selectedIP = localIPs[0].address;
  console.log(`\n✨ Using: ${selectedIP}\n`);

  updateConfig(selectedIP);

  console.log('\n📱 Next steps:');
  console.log('  1. Ensure your device is on the same WiFi network');
  console.log('  2. Start backend: cd backend && npm run dev');
  console.log('  3. Start frontend: cd frontend && npm start');
  console.log('  4. Scan QR code with Expo Go app\n');
} else {
  // Assume it's an IP address
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;

  if (!ipPattern.test(option)) {
    console.error('❌ Invalid option or IP address');
    console.error('💡 Use: node setup-env.js emulator|device|<IP_ADDRESS>');
    process.exit(1);
  }

  console.log(`⚙️  Configuring with IP: ${option}\n`);
  updateConfig(option);

  console.log('\n📱 Next steps:');
  console.log('  1. Ensure your device can reach this IP');
  console.log('  2. Start backend: cd backend && npm run dev');
  console.log('  3. Start frontend: cd frontend && npm start');
  console.log('  4. Scan QR code with Expo Go app\n');
}
