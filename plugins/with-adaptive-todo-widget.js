/* global __dirname */
const { withDangerousMod } = require('expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

// Expo UI's widget environment has no geometry/measurement API. Replace only
// TodoHome's generated entry view, retaining Expo's provider and App Group.
// Append into the existing file so no extra Xcode target/file setup is needed.
// List BEFORE expo-widgets in app.json: dangerous mods execute in reverse order.
module.exports = function withAdaptiveTodoWidget(config) {
  return withDangerousMod(config, ['ios', async config => {
    const file = path.join(config.modRequest.platformProjectRoot, 'ExpoWidgetsTarget', 'TodoHome.swift');
    let source = fs.readFileSync(file, 'utf8');
    const marker = 'WidgetsEntryView(entry: entry)';
    if (!source.includes(marker)) throw new Error('expo-widgets TodoHome template changed; review the adaptive layout integration.');
    source = source.replace(marker, 'TodoAdaptiveHome(props: entry.props ?? [:])');
    source += '\n' + ['TodoWidgetCapacity.swift', 'TodoAdaptiveHome.swift'].map(name => fs.readFileSync(path.join(__dirname, 'native', name), 'utf8')).join('\n');
    fs.writeFileSync(file, source);
    return config;
  }]);
};
