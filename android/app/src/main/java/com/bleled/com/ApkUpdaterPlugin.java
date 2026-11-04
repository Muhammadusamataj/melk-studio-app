package com.bleled.com;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.net.Uri;
import android.os.Build;
import android.os.StatFs;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import org.json.JSONObject;

/**
 * Full-APK self update. It downloads over HTTPS, verifies SHA-256, checks that the file is really this app
 * (same package, higher build number, same signing certificate), and then hands it to Android's own Package
 * Installer with an ACTION_VIEW intent through our FileProvider. The user always confirms in the system screen;
 * there is no silent install. The web layer never passes a file path: install() only accepts the file this
 * plugin itself downloaded and verified.
 *
 * Web updates (the ZIP OTA handled by @capgo/capacitor-updater) are a separate, untouched mechanism.
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {
    private static final String APK_MIME = "application/vnd.android.package-archive";

    /** What was downloaded and checked. Only this file can be installed. */
    private static final class Verified {
        final File file;
        final String sha256;
        final ApkRules.Manifest manifest;

        Verified(File file, String sha256, ApkRules.Manifest manifest) {
            this.file = file;
            this.sha256 = sha256;
            this.manifest = manifest;
        }
    }

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final AtomicBoolean cancel = new AtomicBoolean(false);
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private volatile Verified verified;

    // ---------------------------------------------------------------- info

    @PluginMethod
    public void getInfo(PluginCall call) {
        Context ctx = getContext();
        try {
            ApkRules.Identity me = readInstalled(ctx);
            JSObject o = new JSObject();
            o.put("packageName", me.packageName);
            o.put("versionCode", me.versionCode);
            o.put("versionName", me.versionName);
            o.put("sdk", Build.VERSION.SDK_INT);
            o.put("canInstall", canInstall(ctx));
            o.put("debuggable", (ctx.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0);
            o.put("ready", verified != null && verified.file.isFile());
            o.put("busy", busy.get());
            o.put("signingSha256", toArray(new ArrayList<>(me.certs))); // public certificate fingerprints, not secrets
            File dir = updatesDir(ctx);
            //noinspection ResultOfMethodCallIgnored
            dir.mkdirs();
            o.put("freeBytes", freeBytes(dir));
            call.resolve(o);
        } catch (Exception e) {
            call.reject("Could not read the app details.", "INFO_FAILED", e);
        }
    }

    // ---------------------------------------------------------------- download + verify

    @PluginMethod
    public void download(final PluginCall call) {
        // NOTE: call.getLong() returns null for small JSON numbers (they arrive as Integer), so read numbers from the raw data.
        final JSONObject d = call.getData();
        final String url = d.optString("url", "");
        final String sha = d.optString("sha256", "");
        final long size = d.optLong("size", 0L);
        final long wantCode = d.optLong("versionCode", 0L);
        final String wantPackage = d.optString("packageName", "");
        final String wantCert = d.optString("signingCertSha256", "");
        final int minSdk = d.optInt("minSdk", 0);
        if (wantCode <= 0) {
            call.reject("The update does not state a build number.", UpdateException.BAD_ARGS);
            return;
        }
        if (!busy.compareAndSet(false, true)) {
            call.reject("An update download is already running.", UpdateException.BUSY);
            return;
        }
        cancel.set(false);
        verified = null;
        final Context ctx = getContext().getApplicationContext();
        io.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    File dir = updatesDir(ctx);
                    File dest = new File(dir, "melk-" + wantCode + ".apk");
                    deleteAllExcept(dir, dest.getName());
                    ApkDownloader downloader = ApkDownloader.forProduction(new ApkDownloader.FreeSpace() {
                        @Override
                        public long freeBytes(File f) throws IOException {
                            return ApkUpdaterPlugin.this.freeBytes(f);
                        }
                    });
                    ApkDownloader.Result r = downloader.download(url, dest, sha, size, new ApkDownloader.Progress() {
                        @Override
                        public void onProgress(long downloaded, long total, int percent) {
                            JSObject p = new JSObject();
                            p.put("downloaded", downloaded);
                            p.put("total", total);
                            p.put("percent", percent);
                            notifyListeners("downloadProgress", p);
                        }
                    }, cancel);

                    ApkRules.Manifest manifest = new ApkRules.Manifest(
                            wantPackage.isEmpty() ? null : wantPackage, wantCode, wantCert.isEmpty() ? null : wantCert, minSdk);
                    ApkRules.Verdict verdict = ApkRules.validate(readInstalled(ctx), readArchive(ctx, r.file), manifest, Build.VERSION.SDK_INT);
                    if (!verdict.ok) {
                        //noinspection ResultOfMethodCallIgnored
                        r.file.delete();
                        JSObject data = new JSObject();
                        data.put("problems", toArray(verdict.problems));
                        call.reject(verdict.message, UpdateException.VALIDATION_FAILED, data);
                        return;
                    }
                    ApkRules.Identity apk = readArchive(ctx, r.file);
                    verified = new Verified(r.file, r.sha256, manifest);
                    JSObject out = new JSObject();
                    out.put("ready", true);
                    out.put("fromCache", r.fromCache);
                    out.put("versionCode", apk == null ? wantCode : apk.versionCode);
                    out.put("versionName", apk == null ? "" : apk.versionName);
                    out.put("bytes", r.bytes);
                    out.put("sha256", r.sha256);
                    call.resolve(out);
                } catch (UpdateException e) {
                    call.reject(e.getMessage(), e.code);
                } catch (Exception e) {
                    call.reject("The update could not be prepared.", UpdateException.STORAGE_ERROR, e);
                } finally {
                    busy.set(false);
                }
            }
        });
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        cancel.set(true);
        call.resolve();
    }

    // ---------------------------------------------------------------- install

    @PluginMethod
    public void install(PluginCall call) {
        final Context ctx = getContext();
        final Verified v = verified;
        if (v == null || !v.file.isFile()) {
            call.reject("No verified update is ready. Download it again.", UpdateException.NOT_READY);
            return;
        }
        try {
            // Re-check just before handing over: the file must be unchanged, and still be an upgrade of this very app.
            if (!Hashes.sha256OfFile(v.file).equals(v.sha256)) {
                discard(v);
                call.reject("The saved update changed on disk. Download it again.", UpdateException.CHECKSUM_MISMATCH);
                return;
            }
            ApkRules.Verdict verdict = ApkRules.validate(readInstalled(ctx), readArchive(ctx, v.file), v.manifest, Build.VERSION.SDK_INT);
            if (!verdict.ok) {
                discard(v);
                JSObject data = new JSObject();
                data.put("problems", toArray(verdict.problems));
                call.reject(verdict.message, UpdateException.VALIDATION_FAILED, data);
                return;
            }
        } catch (Exception e) {
            call.reject("Could not check the saved update.", UpdateException.NOT_READY, e);
            return;
        }
        if (!canInstall(ctx)) {
            call.reject("Allow MELK Studio to install apps in Android settings first.", UpdateException.INSTALL_PERMISSION);
            return;
        }

        Uri uri;
        try {
            uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", v.file);
        } catch (IllegalArgumentException e) {
            call.reject("The update folder is not shared with the installer (FileProvider paths).", UpdateException.INSTALL_FAILED, e);
            return;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(uri, APK_MIME);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.setClipData(ClipData.newRawUri("MELK Studio update", uri)); // makes the read grant reliable on every Android version
        for (ResolveInfo ri : ctx.getPackageManager().queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)) {
            ctx.grantUriPermission(ri.activityInfo.packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
        }
        try {
            Activity a = getActivity();
            (a != null ? a : ctx).startActivity(intent); // Android's own Package Installer asks the user to confirm
        } catch (ActivityNotFoundException e) {
            call.reject("This phone has no package installer that can open the update.", UpdateException.INSTALL_FAILED, e);
            return;
        } catch (SecurityException e) {
            call.reject("Android refused to open the installer.", UpdateException.INSTALL_FAILED, e);
            return;
        }
        JSObject out = new JSObject();
        out.put("launched", true);
        call.resolve(out);
    }

    @PluginMethod
    public void openInstallPermissionSettings(PluginCall call) {
        Context ctx = getContext();
        Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            ctx.startActivity(intent);
        } catch (ActivityNotFoundException first) {
            try {
                Intent fallback = new Intent(Settings.ACTION_SECURITY_SETTINGS);
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx.startActivity(fallback);
            } catch (ActivityNotFoundException second) {
                call.reject("Could not open the Android settings screen.", UpdateException.INSTALL_FAILED, second);
                return;
            }
        }
        JSObject out = new JSObject();
        out.put("opened", true);
        call.resolve(out);
    }

    /** Deletes every downloaded update file. Safe to call at any time except while an install is open. */
    @PluginMethod
    public void cleanup(PluginCall call) {
        verified = null;
        File[] files = updatesDir(getContext()).listFiles();
        int n = 0;
        if (files != null) {
            for (File f : files) {
                if (f.delete()) n++;
            }
        }
        JSObject out = new JSObject();
        out.put("deleted", n);
        call.resolve(out);
    }

    @Override
    protected void handleOnDestroy() {
        cancel.set(true);
        io.shutdownNow();
        super.handleOnDestroy();
    }

    // ---------------------------------------------------------------- Android helpers

    private static File updatesDir(Context ctx) {
        return new File(ctx.getFilesDir(), "apk-updates"); // covered by <files-path name="melk_apk_updates"> in file_paths.xml
    }

    private long freeBytes(File dir) throws IOException {
        try {
            return new StatFs(dir.getPath()).getAvailableBytes();
        } catch (IllegalArgumentException e) {
            throw new IOException("Cannot read free space", e);
        }
    }

    private static boolean canInstall(Context ctx) {
        return Build.VERSION.SDK_INT < 26 || ctx.getPackageManager().canRequestPackageInstalls();
    }

    private static void deleteAllExcept(File dir, String keep) {
        File[] files = dir.listFiles();
        if (files == null) return;
        for (File f : files) {
            if (!f.getName().equals(keep)) {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
            }
        }
    }

    private void discard(Verified v) {
        //noinspection ResultOfMethodCallIgnored
        v.file.delete();
        verified = null;
    }

    private static JSArray toArray(List<String> items) {
        JSArray a = new JSArray();
        for (String s : items) a.put(s);
        return a;
    }

    private static int signatureFlags() {
        return Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
    }

    @SuppressWarnings("deprecation")
    private static ApkRules.Identity readInstalled(Context ctx) throws PackageManager.NameNotFoundException {
        PackageInfo pi = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), signatureFlags());
        return identity(pi);
    }

    @SuppressWarnings("deprecation")
    private static ApkRules.Identity readArchive(Context ctx, File apk) {
        PackageInfo pi = ctx.getPackageManager().getPackageArchiveInfo(apk.getAbsolutePath(), signatureFlags());
        return pi == null ? null : identity(pi);
    }

    @SuppressWarnings("deprecation")
    private static ApkRules.Identity identity(PackageInfo pi) {
        List<String> certs = new ArrayList<>();
        if (Build.VERSION.SDK_INT >= 28 && pi.signingInfo != null) {
            SigningInfo si = pi.signingInfo;
            addCerts(certs, si.getApkContentsSigners());
            if (!si.hasMultipleSigners()) addCerts(certs, si.getSigningCertificateHistory()); // key rotation lineage
        } else {
            addCerts(certs, pi.signatures);
        }
        long code = Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode;
        return new ApkRules.Identity(pi.packageName, code, pi.versionName, certs);
    }

    private static void addCerts(List<String> out, Signature[] sigs) {
        if (sigs == null) return;
        for (Signature s : sigs) out.add(Hashes.hex(Hashes.sha256().digest(s.toByteArray())));
    }
}
