package com.bleled.com;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Locale;
import java.util.regex.Pattern;

/** SHA-256 helpers. Pure Java so they can be unit tested without Android. */
final class Hashes {
    private static final Pattern HEX64 = Pattern.compile("^[0-9a-fA-F]{64}$");
    private static final char[] DIGITS = "0123456789abcdef".toCharArray();

    private Hashes() {}

    static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }

    static String hex(byte[] bytes) {
        char[] out = new char[bytes.length * 2];
        for (int i = 0; i < bytes.length; i++) {
            int v = bytes[i] & 0xff;
            out[i * 2] = DIGITS[v >>> 4];
            out[i * 2 + 1] = DIGITS[v & 0x0f];
        }
        return new String(out);
    }

    static boolean isSha256(String s) {
        return s != null && HEX64.matcher(s).matches();
    }

    /** "AA:BB:..." or "aabb..." to lower-case hex without separators; null when it is not a SHA-256 value. */
    static String normalizeFingerprint(String s) {
        if (s == null) return null;
        String t = s.trim().replace(":", "").replace(" ", "").toLowerCase(Locale.ROOT);
        return isSha256(t) ? t : null;
    }

    static String sha256OfBytes(byte[] data) {
        return hex(sha256().digest(data));
    }

    static String sha256OfFile(File f) throws IOException {
        MessageDigest md = sha256();
        byte[] buf = new byte[64 * 1024];
        try (InputStream in = new FileInputStream(f)) {
            int n;
            while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
        }
        return hex(md.digest());
    }
}
