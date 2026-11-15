/* global __dirname */
const { withEntitlementsPlist, withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');
const tools = path.join(path.dirname(require.resolve('expo-widgets/package.json')), 'plugin/build/ios/xcode');
const withTarget = require(path.join(tools, 'withTargetXcodeProject')).default;

const targetName = 'TodoAppUsageMonitor';
const entitlement = 'com.apple.developer.family-controls';

module.exports = function withAppUsage(config) {
  const bundleIdentifier = config.ios.bundleIdentifier + '.usage-monitor';
  config = withEntitlementsPlist(config, config => {
    config.modResults[entitlement] = true;
    return config;
  });

  let files = [];
  config = withDangerousMod(config, ['ios', async config => {
    const directory = path.join(config.modRequest.platformProjectRoot, targetName);
    fs.mkdirSync(directory, { recursive: true });
    const source = path.join(directory, targetName + '.swift');
    fs.copyFileSync(path.join(__dirname, 'native/app-usage', targetName + '.swift'), source);
    const info = path.join(directory, 'Info.plist');
    fs.writeFileSync(info, `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>NSExtension</key><dict>
    <key>NSExtensionPointIdentifier</key><string>com.apple.deviceactivity.monitor-extension</string>
    <key>NSExtensionPrincipalClass</key><string>$(PRODUCT_MODULE_NAME).TodoAppUsageMonitor</string>
  </dict>
</dict></plist>
`);
    const entitlements = path.join(directory, targetName + '.entitlements');
    fs.writeFileSync(entitlements, `<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict><key>${entitlement}</key><true/><key>com.apple.security.application-groups</key><array><string>group.com.nagaiasuka.todo</string></array></dict></plist>
`);
    files = [source, entitlements];
    return config;
  }]);

  return withTarget(config, {
    targetName,
    bundleIdentifier,
    deploymentTarget: '17.4',
    appleTeamId: config.ios.appleTeamId,
    getFileUris: () => files,
  });
};
