const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * Fixes manifest merger conflicts between expo-secure-store and the AppsFlyer SDK.
 * Both libraries declare android:fullBackupContent and android:dataExtractionRules
 * on the <application> element. tools:replace tells the merger to use our app's
 * values and discard the library values.
 *
 * Also ensures AD_ID permission is declared without duplication conflicts.
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

    // Ensure AD_ID permission has tools:node="merge" to prevent duplicate conflicts
    // when AppsFlyer SDK also declares it
    const permissions = manifest["uses-permission"] || [];
    const adIdPerm = permissions.find(
      (p) => p.$?.["android:name"] === "com.google.android.gms.permission.AD_ID"
    );
    if (adIdPerm) {
      adIdPerm.$["tools:node"] = "merge";
    }

    return config;
  });
};
