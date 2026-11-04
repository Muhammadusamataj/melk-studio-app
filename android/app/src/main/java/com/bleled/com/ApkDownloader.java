package com.bleled.com;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Downloads one APK over HTTPS into a ".part" file, hashes it while it streams, checks the size and SHA-256,
 * and only then renames it into place. Pure Java (no Android classes) so it is unit tested on a normal JVM.
 *
 * Failure rules: any failure removes the partial file. Nothing is installed from here.
 */
final class ApkDownloader {
    interface Progress {
        /** percent is 0..100, or -1 when the size is unknown. Called with increasing values only. */
        void onProgress(long downloaded, long total, int percent);
    }

    interface FreeSpace {
        long freeBytes(File dir) throws IOException;
    }

    /** Opens the file to write to. Production writes a normal file; tests inject failures such as "disk full". */
    interface Sink {
        OutputStream open(File f) throws IOException;
    }

    static final class Result {
        final File file;
        final String sha256;
        final long bytes;
        final boolean fromCache;

        Result(File file, String sha256, long bytes, boolean fromCache) {
            this.file = file;
            this.sha256 = sha256;
            this.bytes = bytes;
            this.fromCache = fromCache;
        }
    }

    static final long MAX_APK_BYTES = 250L * 1024 * 1024;
    /** Free space that must remain after the download, so Android can still unpack and install the update. */
    static final long SPACE_MARGIN = 32L * 1024 * 1024;
    private static final int MAX_REDIRECTS = 5;
    private static final long PROGRESS_INTERVAL_MS = 200;

    private final FreeSpace freeSpace;
    private final int connectTimeoutMs;
    private final int readTimeoutMs;
    private final boolean allowLoopbackHttp;
    private final Sink sink;

    ApkDownloader(FreeSpace freeSpace, int connectTimeoutMs, int readTimeoutMs, boolean allowLoopbackHttp, Sink sink) {
        this.freeSpace = freeSpace;
        this.connectTimeoutMs = connectTimeoutMs;
        this.readTimeoutMs = readTimeoutMs;
        this.allowLoopbackHttp = allowLoopbackHttp;
        this.sink = sink;
    }

    /** The only constructor the app uses: HTTPS only, 15 s connect and 30 s read timeouts, plain file output. */
    static ApkDownloader forProduction(FreeSpace freeSpace) {
        return new ApkDownloader(freeSpace, 15_000, 30_000, false, f -> new BufferedOutputStream(new FileOutputStream(f), 64 * 1024));
    }

    Result download(String urlText, File dest, String expectedSha256, long expectedSize, Progress progress, AtomicBoolean cancel)
            throws UpdateException {
        if (!Hashes.isSha256(expectedSha256)) throw new UpdateException(UpdateException.BAD_ARGS, "The update has no valid SHA-256 checksum.");
        if (expectedSize <= 0) throw new UpdateException(UpdateException.BAD_ARGS, "The update does not state its file size.");
        if (expectedSize > MAX_APK_BYTES) throw new UpdateException(UpdateException.TOO_LARGE, "The update is larger than " + (MAX_APK_BYTES >> 20) + " MB.");
        final String want = expectedSha256.toLowerCase(Locale.ROOT);
        URL url = checkUrl(urlText);

        File dir = dest.getParentFile();
        if (dir == null || (!dir.isDirectory() && !dir.mkdirs())) throw new UpdateException(UpdateException.STORAGE_ERROR, "Could not create the update folder.");

        // A file from an earlier attempt that already matches is reused: nothing is downloaded again.
        if (dest.isFile()) {
            try {
                if (dest.length() == expectedSize && want.equals(Hashes.sha256OfFile(dest))) {
                    if (progress != null) progress.onProgress(expectedSize, expectedSize, 100);
                    return new Result(dest, want, expectedSize, true);
                }
            } catch (IOException ignored) {
                // unreadable: fall through and download again
            }
            //noinspection ResultOfMethodCallIgnored
            dest.delete();
        }

        File part = new File(dir, dest.getName() + ".part");
        //noinspection ResultOfMethodCallIgnored
        part.delete();

        long required = expectedSize + SPACE_MARGIN;
        long free;
        try {
            free = freeSpace.freeBytes(dir);
        } catch (IOException e) {
            free = Long.MAX_VALUE; // cannot tell: do not block, a real "disk full" is still caught while writing
        }
        if (free < required) {
            throw new UpdateException(UpdateException.NO_SPACE,
                    "Not enough free storage. About " + mb(required) + " MB is needed and " + mb(Math.max(free, 0)) + " MB is free.");
        }

        HttpURLConnection conn = null;
        try {
            if (cancel != null && cancel.get()) throw new UpdateException(UpdateException.CANCELLED, "Download cancelled.");
            if (progress != null) progress.onProgress(0, expectedSize, 0);
            conn = open(url);
            long declared = conn.getContentLengthLong();
            if (declared > MAX_APK_BYTES) throw new UpdateException(UpdateException.TOO_LARGE, "The server offers a file larger than " + (MAX_APK_BYTES >> 20) + " MB.");
            if (declared >= 0 && declared != expectedSize) {
                throw new UpdateException(UpdateException.SIZE_MISMATCH, "The file on the server is " + declared + " bytes, but the update says " + expectedSize + ".");
            }

            MessageDigest md = Hashes.sha256();
            byte[] buf = new byte[64 * 1024];
            long done = 0;
            int lastPct = 0;
            long lastEmit = 0;
            OutputStream out;
            try {
                out = sink.open(part);
            } catch (IOException e) {
                throw classify(e);
            }
            InputStream in;
            try {
                in = conn.getInputStream();
            } catch (SocketTimeoutException e) {
                try { out.close(); } catch (IOException ignored) { /* nothing was written yet */ }
                throw new UpdateException(UpdateException.NETWORK_TIMEOUT, "The connection timed out.", e);
            } catch (IOException e) {
                try { out.close(); } catch (IOException ignored) { /* nothing was written yet */ }
                throw new UpdateException(UpdateException.NETWORK, "Could not read the update from the server.", e);
            }
            try {
                while (true) {
                    if (cancel != null && cancel.get()) throw new UpdateException(UpdateException.CANCELLED, "Download cancelled.");
                    int n;
                    try {
                        n = in.read(buf);
                    } catch (SocketTimeoutException e) {
                        throw new UpdateException(UpdateException.NETWORK_TIMEOUT, "The connection timed out.", e);
                    } catch (IOException e) {
                        throw new UpdateException(UpdateException.NETWORK, "The connection was lost during the download.", e);
                    }
                    if (n < 0) break;
                    done += n;
                    if (done > expectedSize) throw new UpdateException(UpdateException.SIZE_MISMATCH, "The server sent more data than the update says.");
                    md.update(buf, 0, n);
                    try {
                        out.write(buf, 0, n);
                    } catch (IOException e) {
                        throw classify(e);
                    }
                    if (progress != null) {
                        int pct = (int) Math.min(99, done * 100 / expectedSize); // 100 is reserved for "verified"
                        long now = System.currentTimeMillis();
                        if (pct > lastPct && (now - lastEmit >= PROGRESS_INTERVAL_MS || pct - lastPct >= 5)) {
                            lastPct = pct;
                            lastEmit = now;
                            progress.onProgress(done, expectedSize, pct);
                        }
                    }
                }
                try {
                    out.flush();
                } catch (IOException e) {
                    throw classify(e);
                }
            } finally {
                try { in.close(); } catch (IOException ignored) { /* already finished or failed */ }
                try {
                    out.close();
                } catch (IOException ignored) {
                    // a failed close surfaces as a short or corrupt file, which the size and hash checks catch
                }
            }

            if (done != expectedSize) {
                throw new UpdateException(UpdateException.NETWORK, "The download ended early (" + done + " of " + expectedSize + " bytes).");
            }
            String got = Hashes.hex(md.digest());
            if (!got.equals(want)) {
                throw new UpdateException(UpdateException.CHECKSUM_MISMATCH,
                        "The downloaded file does not match its SHA-256 checksum (expected " + want.substring(0, 12) + "..., got " + got.substring(0, 12) + "...).");
            }
            //noinspection ResultOfMethodCallIgnored
            dest.delete();
            if (!part.renameTo(dest)) throw new UpdateException(UpdateException.STORAGE_ERROR, "Could not save the downloaded file.");
            if (progress != null) progress.onProgress(done, expectedSize, 100);
            return new Result(dest, got, done, false);
        } catch (UpdateException e) {
            //noinspection ResultOfMethodCallIgnored
            part.delete();
            throw e;
        } catch (RuntimeException e) {
            //noinspection ResultOfMethodCallIgnored
            part.delete();
            throw new UpdateException(UpdateException.NETWORK, "The download failed unexpectedly.", e);
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    // ----- helpers -----

    @SuppressWarnings("deprecation") // java.net.URL(String) is deprecated on newer JDKs but is the standard API on Android
    private static URL parseUrl(String text) throws MalformedURLException {
        return new URL(text);
    }

    @SuppressWarnings("deprecation")
    private static URL parseUrl(URL base, String text) throws MalformedURLException {
        return new URL(base, text);
    }

    private URL checkUrl(String text) throws UpdateException {
        URL u;
        try {
            u = parseUrl(text);
        } catch (MalformedURLException e) {
            throw new UpdateException(UpdateException.BAD_URL, "The update address is not valid.", e);
        }
        if (u.getUserInfo() != null) throw new UpdateException(UpdateException.BAD_URL, "The update address must not contain a user name or password.");
        if (u.getHost() == null || u.getHost().isEmpty()) throw new UpdateException(UpdateException.BAD_URL, "The update address has no server name.");
        String p = u.getProtocol();
        if ("https".equals(p)) return u;
        if (allowLoopbackHttp && "http".equals(p)) {
            String h = u.getHost();
            if ("127.0.0.1".equals(h) || "localhost".equals(h) || "[::1]".equals(h)) return u;
        }
        throw new UpdateException(UpdateException.BAD_URL, "Updates are only downloaded over HTTPS.");
    }

    /** Opens the connection, following up to five redirects. Every hop must pass checkUrl, so https never downgrades to http. */
    private HttpURLConnection open(URL start) throws UpdateException {
        URL cur = start;
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            HttpURLConnection c;
            int code;
            try {
                c = (HttpURLConnection) cur.openConnection();
                c.setInstanceFollowRedirects(false);
                c.setConnectTimeout(connectTimeoutMs);
                c.setReadTimeout(readTimeoutMs);
                c.setRequestProperty("Accept-Encoding", "identity"); // keep Content-Length equal to the real file size
                c.setRequestProperty("User-Agent", "MELK-Studio-Updater");
                code = c.getResponseCode();
            } catch (SocketTimeoutException e) {
                throw new UpdateException(UpdateException.NETWORK_TIMEOUT, "The connection timed out.", e);
            } catch (IOException e) {
                throw new UpdateException(UpdateException.NETWORK, "Could not reach the update server.", e);
            }
            if (code == 301 || code == 302 || code == 303 || code == 307 || code == 308) {
                String loc = c.getHeaderField("Location");
                c.disconnect();
                if (loc == null) throw new UpdateException(UpdateException.NETWORK, "The server sent an empty redirect.");
                try {
                    cur = checkUrl(parseUrl(cur, loc).toString());
                } catch (MalformedURLException e) {
                    throw new UpdateException(UpdateException.BAD_URL, "The server redirected to an invalid address.", e);
                }
                continue;
            }
            if (code != 200) {
                c.disconnect();
                throw new UpdateException(UpdateException.HTTP_ERROR, "The update server answered " + code + (code == 404 ? " (file not found)" : "") + ".");
            }
            return c;
        }
        throw new UpdateException(UpdateException.NETWORK, "The server redirected too many times.");
    }

    private static UpdateException classify(IOException e) {
        String m = String.valueOf(e.getMessage()).toLowerCase(Locale.ROOT);
        if (m.contains("no space left") || m.contains("enospc") || m.contains("disk full") || m.contains("quota")) {
            return new UpdateException(UpdateException.NO_SPACE, "The phone ran out of storage while saving the update.", e);
        }
        return new UpdateException(UpdateException.STORAGE_ERROR, "Could not write the update file.", e);
    }

    private static long mb(long bytes) {
        return (bytes + (1L << 20) - 1) >> 20;
    }
}
