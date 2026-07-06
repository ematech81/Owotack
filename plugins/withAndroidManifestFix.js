const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Fixes manifest merger conflicts between expo-secure-store and the AppsFlyer SDK.
 * Both libraries declare android:fullBackupContent and android:dataExtractionRules
 * on the <application> element. tools:replace tells the merger to use our app's
 * values and discard the library values.
 */
module.exports = function withAndroidManifestFix(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    // Declare the tools namespace if not already present
    if (!manifest.$["xmlns:tools"]) {
      manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    }

    const mainApplication = manifest.application[0];
    mainApplication.$["tools:replace"] = "android:fullBackupContent,android:dataExtractionRules";

    return config;
  });
};
