package com.bleled.com;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.Collections;
import org.junit.Test;

public class ApkRulesTest {
    private static final String KEY_A = Hashes.sha256OfBytes("key-a".getBytes());
    private static final String KEY_B = Hashes.sha256OfBytes("key-b".getBytes());
    private static final String PKG = "com.bleled.com";

    private static ApkRules.Identity installed() { return new ApkRules.Identity(PKG, 10106, "1.1.6", Arrays.asList(KEY_A)); }
    private static ApkRules.Identity apk(String pkg, long code, String... certs) { return new ApkRules.Identity(pkg, code, "x", Arrays.asList(certs)); }
    private static ApkRules.Manifest manifest(long code) { return new ApkRules.Manifest(PKG, code, null, 0); }

    @Test public void aNewerBuildSignedWithTheSameKeyIsAllowed() {
        ApkRules.Verdict v = ApkRules.validate(installed(), apk(PKG, 10107, KEY_A), manifest(10107), 34);
        assertTrue(v.message, v.ok);
        assertTrue(v.problems.isEmpty());
    }
    @Test public void aDifferentPackageIsBlocked() {
        ApkRules.Verdict v = ApkRules.validate(installed(), apk("com.other.app", 10107, KEY_A), new ApkRules.Manifest("com.other.app", 10107, null, 0), 34);
        assertFalse(v.ok); assertTrue(v.problems.contains(ApkRules.PACKAGE_MISMATCH));
    }
    @Test public void aDifferentSigningKeyIsBlocked() {
        ApkRules.Verdict v = ApkRules.validate(installed(), apk(PKG, 10107, KEY_B), manifest(10107), 34);
        assertFalse(v.ok); assertEquals(Arrays.asList(ApkRules.SIGNATURE_MISMATCH), v.problems);
        assertTrue(v.message.contains("different key"));
    }
    @Test public void anUnsignedApkIsBlocked() {
        ApkRules.Verdict v = ApkRules.validate(installed(), apk(PKG, 10107), manifest(10107), 34);
        assertFalse(v.ok); assertTrue(v.problems.contains(ApkRules.NO_SIGNATURE));
        assertFalse("with no certificate there is nothing to compare", v.problems.contains(ApkRules.SIGNATURE_MISMATCH));
    }
    @Test public void aDowngradeAndTheSameBuildAreBlocked() {
        assertTrue(ApkRules.validate(installed(), apk(PKG, 10105, KEY_A), manifest(10105), 34).problems.contains(ApkRules.DOWNGRADE));
        ApkRules.Verdict same = ApkRules.validate(installed(), apk(PKG, 10106, KEY_A), manifest(10106), 34);
        assertFalse(same.ok); assertTrue(same.problems.contains(ApkRules.SAME_VERSION));
    }
    @Test public void theManifestMustDescribeTheFileThatWasDownloaded() {
        assertTrue(ApkRules.validate(installed(), apk(PKG, 10107, KEY_A), manifest(10108), 34).problems.contains(ApkRules.MANIFEST_VERSION));
        ApkRules.Manifest wrongPkg = new ApkRules.Manifest("com.other", 10107, null, 0);
        assertTrue(ApkRules.validate(installed(), apk(PKG, 10107, KEY_A), wrongPkg, 34).problems.contains(ApkRules.MANIFEST_PACKAGE));
    }
    @Test public void aSigningKeyPromisedByTheManifestIsChecked() {
        ApkRules.Manifest ok = new ApkRules.Manifest(PKG, 10107, KEY_A.toUpperCase(), 0);
        assertTrue(ApkRules.validate(installed(), apk(PKG, 10107, KEY_A), ok, 34).ok);
        ApkRules.Manifest other = new ApkRules.Manifest(PKG, 10107, KEY_B, 0);
        ApkRules.Verdict v = ApkRules.validate(installed(), apk(PKG, 10107, KEY_A), other, 34);
        assertFalse(v.ok); assertEquals(Arrays.asList(ApkRules.MANIFEST_SIGNATURE), v.problems);
    }
    @Test public void aPhoneThatIsTooOldIsBlocked() {
        ApkRules.Manifest m = new ApkRules.Manifest(PKG, 10107, null, 30);
        assertTrue(ApkRules.validate(installed(), apk(PKG, 10107, KEY_A), m, 28).problems.contains(ApkRules.MIN_SDK));
        assertTrue(ApkRules.validate(installed(), apk(PKG, 10107, KEY_A), m, 30).ok);
    }
    @Test public void anUnreadableFileIsBlocked() {
        ApkRules.Verdict v = ApkRules.validate(installed(), null, manifest(10107), 34);
        assertFalse(v.ok); assertEquals(Arrays.asList(ApkRules.UNREADABLE), v.problems);
    }
    @Test public void everyProblemIsReportedNotJustTheFirst() {
        ApkRules.Verdict v = ApkRules.validate(installed(), apk("com.other", 10100, KEY_B), manifest(10107), 34);
        assertTrue(v.problems.containsAll(Arrays.asList(ApkRules.PACKAGE_MISMATCH, ApkRules.MANIFEST_PACKAGE.equals("x") ? "" : ApkRules.DOWNGRADE, ApkRules.SIGNATURE_MISMATCH, ApkRules.MANIFEST_VERSION)));
        assertTrue(v.message.length() > 50);
    }
    @Test public void aRotatedKeyThatStillContainsTheOldCertificateIsAccepted() {
        // the installed app lists its signing history; an update signed by any certificate in it, or sharing one, is compatible
        ApkRules.Identity inst = new ApkRules.Identity(PKG, 10106, "1.1.6", Arrays.asList(KEY_A, KEY_B));
        assertTrue(ApkRules.validate(inst, apk(PKG, 10107, KEY_B), manifest(10107), 34).ok);
    }
    @Test public void fingerprintsAreNormalised() {
        String colon = "AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99";
        assertEquals("aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899", Hashes.normalizeFingerprint(colon));
        assertNull(Hashes.normalizeFingerprint("not a hash"));
        assertNull(Hashes.normalizeFingerprint(null));
        assertTrue(new ApkRules.Identity(PKG, 1, "x", Collections.singletonList("zzz")).certs.isEmpty());
    }
}
