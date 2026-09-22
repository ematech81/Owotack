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

    // Force the AD_ID permission to survive the manifest merge. Google's own Play
    // Services libraries (pulled in transitively) now strip this permission from
    // their own bundled manifest by default — a plain declaration, or even
    // tools:node="merge", loses to an explicit removal from a dependency.
    // tools:node="replace" is the only directive that makes our declaration win
    // regardless of what any library does. Without this, Play Console flags the
    // app as declaring "uses advertising ID" while the compiled manifest doesn't
    // actually request the permission, silently zeroing out AppsFlyer's ad ID.
    const AD_ID_PERMISSION = "com.google.android.gms.permission.AD_ID";
    const permissions = manifest["uses-permission"] || [];
    const adIdPerm = permissions.find((p) => p.$?.["android:name"] === AD_ID_PERMISSION);
    if (adIdPerm) {
      adIdPerm.$["tools:node"] = "replace";
    } else {
      permissions.push({ $: { "android:name": AD_ID_PERMISSION, "tools:node": "replace" } });
      manifest["uses-permission"] = permissions;
    }

    return config;
  });
};
