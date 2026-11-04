package com.bleled.com;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * The decision "may this downloaded APK replace the installed app?". Pure Java: Android fills in the two
 * Identity objects, this class only compares them. Any problem blocks the installation.
 */
final class ApkRules {
    static final String UNREADABLE = "UNREADABLE";
    static final String PACKAGE_MISMATCH = "PACKAGE_MISMATCH";
    static final String DOWNGRADE = "DOWNGRADE";
    static final String SAME_VERSION = "SAME_VERSION";
    static final String NO_SIGNATURE = "NO_SIGNATURE";
    static final String SIGNATURE_MISMATCH = "SIGNATURE_MISMATCH";
    static final String MANIFEST_PACKAGE = "MANIFEST_PACKAGE";
    static final String MANIFEST_VERSION = "MANIFEST_VERSION";
    static final String MANIFEST_SIGNATURE = "MANIFEST_SIGNATURE";
    static final String MIN_SDK = "MIN_SDK";

    private ApkRules() {}

    /** What an APK (or the installed app) says about itself. certs are SHA-256 fingerprints of signing certificates. */
    static final class Identity {
        final String packageName;
        final long versionCode;
        final String versionName;
        final Set<String> certs;

        Identity(String packageName, long versionCode, String versionName, Collection<String> certs) {
            this.packageName = packageName;
            this.versionCode = versionCode;
            this.versionName = versionName;
            Set<String> clean = new LinkedHashSet<>();
            if (certs != null) {
                for (String c : certs) {
                    String n = Hashes.normalizeFingerprint(c);
                    if (n != null) clean.add(n);
                }
            }
            this.certs = Collections.unmodifiableSet(clean);
        }
    }

    /** What apk-version.json promised. signingCertSha256 may be null; minSdk 0 means "not stated". */
    static final class Manifest {
        final String packageName;
        final long versionCode;
        final String signingCertSha256;
        final int minSdk;

        Manifest(String packageName, long versionCode, String signingCertSha256, int minSdk) {
            this.packageName = packageName;
            this.versionCode = versionCode;
            this.signingCertSha256 = Hashes.normalizeFingerprint(signingCertSha256);
            this.minSdk = minSdk;
        }
    }

    static final class Verdict {
        final boolean ok;
        final List<String> problems;
        final String message;

        Verdict(List<String> problems, String message) {
            this.ok = problems.isEmpty();
            this.problems = Collections.unmodifiableList(problems);
            this.message = message;
        }
    }

    static String describe(String code) {
        switch (code) {
            case UNREADABLE: return "Android could not read the downloaded file as an app package.";
            case PACKAGE_MISMATCH: return "The downloaded app has a different package name, so it cannot update MELK Studio.";
            case DOWNGRADE: return "The downloaded app is older than the installed one.";
            case SAME_VERSION: return "The downloaded app has the same build number as the installed one.";
            case NO_SIGNATURE: return "The downloaded app is not signed.";
            case SIGNATURE_MISMATCH: return "The downloaded app is signed with a different key from the installed app, so Android would refuse it.";
            case MANIFEST_PACKAGE: return "The update description names a different package from the downloaded file.";
            case MANIFEST_VERSION: return "The update description names a different build number from the downloaded file.";
            case MANIFEST_SIGNATURE: return "The signing key of the downloaded file is not the one the update description promised.";
            case MIN_SDK: return "This update needs a newer version of Android than this phone has.";
            default: return code;
        }
    }

    /**
     * @param installed identity of the running app (current and historic signing certificates)
     * @param apk       identity read from the downloaded file, or null when Android could not parse it
     * @param manifest  the values from apk-version.json
     * @param deviceSdk Build.VERSION.SDK_INT
     */
    static Verdict validate(Identity installed, Identity apk, Manifest manifest, int deviceSdk) {
        List<String> problems = new ArrayList<>();
        if (apk == null || apk.packageName == null) {
            problems.add(UNREADABLE);
            return finish(problems);
        }
        if (!apk.packageName.equals(installed.packageName)) problems.add(PACKAGE_MISMATCH);
        if (manifest.packageName != null && !manifest.packageName.equals(apk.packageName)) problems.add(MANIFEST_PACKAGE);
        if (apk.versionCode < installed.versionCode) problems.add(DOWNGRADE);
        else if (apk.versionCode == installed.versionCode) problems.add(SAME_VERSION);
        if (manifest.versionCode != apk.versionCode) problems.add(MANIFEST_VERSION);
        if (apk.certs.isEmpty()) {
            problems.add(NO_SIGNATURE);
        } else {
            boolean overlap = false;
            for (String c : apk.certs) {
                if (installed.certs.contains(c)) { overlap = true; break; }
            }
            if (!overlap) problems.add(SIGNATURE_MISMATCH);
            if (manifest.signingCertSha256 != null && !apk.certs.contains(manifest.signingCertSha256)) problems.add(MANIFEST_SIGNATURE);
        }
        if (manifest.minSdk > deviceSdk) problems.add(MIN_SDK);
        return finish(problems);
    }

    private static Verdict finish(List<String> problems) {
        StringBuilder sb = new StringBuilder();
        for (String p : problems) {
            if (sb.length() > 0) sb.append(' ');
            sb.append(describe(p));
        }
        return new Verdict(problems, sb.toString());
    }
}
