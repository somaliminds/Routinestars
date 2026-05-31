const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Allow Metro to resolve CSS files as source modules on web.
// NativeWind's withNativeWind handles the Tailwind compilation pipeline;
// we only need to ensure 'css' is treated as a source extension so Metro
// doesn't try to load it as a binary asset on the web platform.
const { assetExts, sourceExts } = config.resolver;
config.resolver.assetExts = assetExts.filter((ext) => ext !== 'css');
config.resolver.sourceExts = [...sourceExts, 'css'];

module.exports = withNativeWind(config, { input: './global.css' });
