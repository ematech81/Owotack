const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Fixes a manifest merger conflict between expo-secure-store and
 * the AppsFlyer SDK — both declare android:fullBackupContent on
 * the <application> element. Adding tools:replace tells the merger
 * to use our value and discard the library's value.
 */
module.exports = function withAndroidManifestFix(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Declare the tools namespace if not already present
    if (!manifest.$["xmlns:tools"]) {
      manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    }

    const mainApplication = manifest.application[0];
    mainApplication.$["tools:replace"] = "android:fullBackupContent";

    return config;
  });
};
