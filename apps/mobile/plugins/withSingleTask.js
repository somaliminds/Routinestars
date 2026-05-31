/**
 * Config plugin: sets android:launchMode="singleTask" on the main activity.
 * Required by Expo Router to prevent "linking configured in multiple places" error.
 * Only applies during native builds (eas build / expo prebuild) — skipped at expo start.
 */
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = withAndroidManifest(config => {
  const manifest = config.modResults;
  // modResults is only present during a native build — skip during expo start
  if (!manifest?.manifest?.application?.[0]) return config;

  const mainActivity = manifest.manifest.application[0].activity?.find(
    a => a.$?.['android:name'] === '.MainActivity',
  );

  if (mainActivity) {
    mainActivity.$['android:launchMode'] = 'singleTask';
  }

  return config;
});
