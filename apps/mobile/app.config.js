/**
 * Dynamic Expo config — wraps app.json so we can inject runtime values
 * (like file paths that come from EAS environment variables at build time).
 *
 * When EAS uploads the GOOGLE_SERVICES_JSON file env var, it writes the
 * file to a temporary path and sets process.env.GOOGLE_SERVICES_JSON to
 * that path. We override the android.googleServicesFile from app.json
 * with that path so the Gradle build can find the FCM credentials.
 *
 * Locally (no env var set), it falls back to ./google-services.json
 * which is gitignored but present on disk.
 */
module.exports = ({ config }) => {
  const googleServicesPath =
    process.env.GOOGLE_SERVICES_JSON || config.android?.googleServicesFile;

  return {
    ...config,
    android: {
      ...config.android,
      googleServicesFile: googleServicesPath,
    },
  };
};
