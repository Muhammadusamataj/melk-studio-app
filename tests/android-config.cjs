// Static checks of the Android project files that make the app-update installer work and keep it safe.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const R = (p) => fs.readFileSync(p, 'utf8');
const manifest = R('android/app/src/main/AndroidManifest.xml');
const paths = R('android/app/src/main/res/xml/file_paths.xml');
const gradle = R('android/app/build.gradle');
const plugin = R('android/app/src/main/java/com/bleled/com/ApkUpdaterPlugin.java');
const downloader = R('android/app/src/main/java/com/bleled/com/ApkDownloader.java');
const main = R('android/app/src/main/java/com/bleled/com/MainActivity.java');
const webVersion = /APP_VERSION\s*=\s*'([^']+)'/.exec(R('www/js/ota.js'))[1];

test('package id and namespace are unchanged', () => {
  assert.match(gradle, /applicationId\s+"com\.bleled\.com"/); assert.match(gradle, /namespace\s*=\s*"com\.bleled\.com"/);
  assert.match(manifest, /android:name="\.MainActivity"/);
});
test('versionCode went up from 10106 and versionName matches the web version', () => {
  const code = Number(/def buildCode = .*?\?: '(\d+)'/.exec(gradle)[1]); const name = /def buildName = .*?\?: '([^']+)'/.exec(gradle)[1];
  assert.ok(code > 10106, 'versionCode ' + code); assert.equal(name, webVersion);
  assert.equal(JSON.parse(R('package.json')).version, webVersion);
  const [a, b, c] = name.split('.').map(Number); assert.equal(code, 10000 + b * 100 + c, 'versionCode follows 10000 + minor*100 + patch');
});
test('the installer permission and package visibility are declared', () => {
  assert.match(manifest, /android\.permission\.REQUEST_INSTALL_PACKAGES/);
  assert.match(manifest, /<queries>[\s\S]*android\.intent\.action\.VIEW[\s\S]*application\/vnd\.android\.package-archive[\s\S]*<\/queries>/);
});
test('the existing permissions and FileProvider are preserved', () => {
  ['INTERNET', 'RECORD_AUDIO', 'BLUETOOTH_SCAN'].forEach((p) => assert.match(manifest, new RegExp('android\\.permission\\.' + p)));
  assert.match(manifest, /neverForLocation/);
  assert.match(manifest, /androidx\.core\.content\.FileProvider/); assert.match(manifest, /\$\{applicationId\}\.fileprovider/);
  assert.match(manifest, /android:exported="false"/); assert.match(manifest, /android:grantUriPermissions="true"/);
  assert.match(paths, /<external-path name="my_images"/); assert.match(paths, /<cache-path name="my_cache_images"/);
});
test('the FileProvider covers exactly the folder the plugin downloads into, and the authority matches', () => {
  assert.match(paths, /<files-path name="melk_apk_updates" path="apk-updates\/"\s*\/>/);
  assert.match(plugin, /new File\(ctx\.getFilesDir\(\), "apk-updates"\)/);
  assert.match(plugin, /ctx\.getPackageName\(\) \+ "\.fileprovider"/);
});
test('install uses the visible Android installer only (ACTION_VIEW), never a silent path', () => {
  assert.match(plugin, /Intent\.ACTION_VIEW/); assert.match(plugin, /application\/vnd\.android\.package-archive/);
  assert.match(plugin, /FLAG_GRANT_READ_URI_PERMISSION/); assert.match(plugin, /FileProvider\.getUriForFile/);
  assert.match(plugin, /canRequestPackageInstalls/); assert.match(plugin, /ACTION_MANAGE_UNKNOWN_APP_SOURCES/);
  const all = plugin + downloader + R('android/app/src/main/java/com/bleled/com/ApkRules.java');
  [/PackageInstaller\.Session/, /android\.permission\.INSTALL_PACKAGES/, /Runtime\.getRuntime\(\)/, /ProcessBuilder/, /"su"/, /pm install/, /ACTION_INSTALL_PACKAGE/, /DexClassLoader/, /setDataAndType\([^)]*file:/].forEach((re) => assert.doesNotMatch(all, re, String(re)));
});
test('the web layer cannot choose which file is installed', () => {
  assert.doesNotMatch(plugin.slice(plugin.indexOf('public void install')), /getString\("path"\)|optString\("path"/);
  assert.match(plugin, /private volatile Verified verified/);
});
test('numbers from JavaScript are read from the raw data, not call.getLong (which returns null for small numbers)', () => {
  const dl = plugin.slice(plugin.indexOf('public void download'), plugin.indexOf('public void cancelDownload')).replace(/\/\/.*$/gm, '');   // code only, not comments
  assert.doesNotMatch(dl, /call\.getLong\(/); assert.match(dl, /optLong\("size"/); assert.match(dl, /optLong\("versionCode"/);
});
test('the downloader only accepts https and the plugin always uses the production constructor', () => {
  assert.match(plugin, /ApkDownloader\.forProduction/); assert.doesNotMatch(plugin, /new ApkDownloader\(/);
  assert.match(downloader, /forProduction[\s\S]*?, false,/);
});
test('both native plugins are registered', () => {
  assert.match(main, /registerPlugin\(AudioLevelPlugin\.class\)/); assert.match(main, /registerPlugin\(ApkUpdaterPlugin\.class\)/);
});
test('signing material is never packaged and never hard-coded', () => {
  assert.doesNotMatch(gradle, /storePassword\s+["'][^"']+["']/); assert.doesNotMatch(gradle, /keyPassword\s+["'][^"']+["']/);
  assert.match(gradle, /keystore\.properties/);
  const ignored = R('.gitignore') + R('android/.gitignore');
  ['keystore.properties', '*.jks', '*.keystore'].forEach((x) => assert.ok(ignored.includes(x), x + ' is git-ignored'));
  const found = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (['node_modules', '.git', 'build', '.gradle'].includes(e.name)) continue; const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(jks|keystore|p12|pfx|apk|aab)$/i.test(e.name) || e.name === 'keystore.properties') found.push(p); } })('.');
  assert.deepEqual(found, [], 'no key or APK files in the source tree');
});
