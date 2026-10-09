// Runs the example against the library's source in `..` (no build step, edits
// hot-reload). The library's own node_modules hold dev copies of React, RN and
// friends — block those and resolve the shared packages from the example's
// node_modules instead, or the app ends up with two Reacts.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const root = path.resolve(__dirname, '..');
const pkg = require('../package.json');

const config = getDefaultConfig(__dirname);

const shared = [
  ...Object.keys(pkg.peerDependencies),
  'expo',
  'expo-modules-core',
  'react-native-worklets',
];
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

config.watchFolders = [root];
config.resolver.blockList = [
  ...[].concat(config.resolver.blockList ?? []),
  ...shared.map((name) => new RegExp(`^${escape(path.join(root, 'node_modules', name))}\\/.*$`)),
];
config.resolver.extraNodeModules = {
  ...Object.fromEntries(shared.map((name) => [name, path.join(__dirname, 'node_modules', name)])),
  [pkg.name]: root,
};

module.exports = config;
