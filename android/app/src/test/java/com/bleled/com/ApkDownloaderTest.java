package com.bleled.com;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.ServerSocket;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

/** Runs the real downloader against a real local HTTP server. Cleartext loopback is allowed ONLY through the test constructor. */
public class ApkDownloaderTest {
    private HttpServer server;
    private int port;
    private File dir;
    private byte[] body;
    private String sha;
    private final AtomicInteger hits = new AtomicInteger();
    private static final ApkDownloader.FreeSpace PLENTY = d -> 10L * 1024 * 1024 * 1024;

    @Before
    public void setUp() throws Exception {
        dir = Files.createTempDirectory("apk-test").toFile();
        body = new byte[600_000];
        new Random(42).nextBytes(body);
        sha = Hashes.sha256OfBytes(body);
        server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), 0), 0);
        port = server.getAddress().getPort();
        server.createContext("/ok.apk", ex -> { hits.incrementAndGet(); send(ex, body, body.length); });
        server.createContext("/bad.apk", ex -> { hits.incrementAndGet(); byte[] t = body.clone(); t[1234] ^= 0x01; send(ex, t, t.length); });
        server.createContext("/slow.apk", ex -> {
            hits.incrementAndGet();
            ex.sendResponseHeaders(200, body.length);
            try (OutputStream o = ex.getResponseBody()) {
                for (int i = 0; i < body.length; i += 20_000) {
                    o.write(body, i, Math.min(20_000, body.length - i));
                    o.flush();
                    Thread.sleep(30);
                }
            } catch (Exception ignored) { /* the client cancelled */ }
        });
        server.createContext("/cut.apk", ex -> {
            hits.incrementAndGet();
            ex.sendResponseHeaders(200, body.length);
            OutputStream o = ex.getResponseBody();
            o.write(body, 0, body.length / 2);
            o.flush();
            ex.getHttpContext().getServer(); // keep the exchange; closing the socket below drops the connection
            try { ex.close(); } catch (Exception ignored) { /* expected: fewer bytes than declared */ }
        });
        server.createContext("/stall.apk", ex -> {
            hits.incrementAndGet();
            ex.sendResponseHeaders(200, body.length);
            OutputStream o = ex.getResponseBody();
            o.write(body, 0, 10_000);
            o.flush();
            try { Thread.sleep(3000); } catch (InterruptedException ignored) { /* test finished */ }
            try { ex.close(); } catch (Exception ignored) { /* client is gone */ }
        });
        server.createContext("/missing", ex -> { hits.incrementAndGet(); ex.sendResponseHeaders(404, -1); ex.close(); });
        server.createContext("/redir", ex -> redirect(ex, "/ok.apk"));
        server.createContext("/redir-out", ex -> redirect(ex, "http://example.com/x.apk"));
        server.createContext("/redir-loop", ex -> redirect(ex, "/redir-loop"));
        server.createContext("/short-header.apk", ex -> { hits.incrementAndGet(); send(ex, body, body.length - 10); });
        server.createContext("/long.apk", ex -> {
            hits.incrementAndGet();
            ex.sendResponseHeaders(200, 0); // chunked, no Content-Length
            try (OutputStream o = ex.getResponseBody()) {
                o.write(body);
                o.write(new byte[100]);
            } catch (Exception ignored) { /* client stopped reading */ }
        });
        server.createContext("/huge.apk", ex -> { hits.incrementAndGet(); ex.sendResponseHeaders(200, 300L * 1024 * 1024); try { ex.close(); } catch (Exception ignored) { /* never sent */ } });
        server.start();
    }

    @After
    public void tearDown() {
        server.stop(0);
        File[] fs = dir.listFiles();
        if (fs != null) for (File f : fs) f.delete();
        dir.delete();
    }

    private static void send(HttpExchange ex, byte[] data, int declared) throws IOException {
        ex.sendResponseHeaders(200, declared);
        try (OutputStream o = ex.getResponseBody()) { o.write(data, 0, Math.min(data.length, declared)); }
    }

    private void redirect(HttpExchange ex, String to) throws IOException {
        hits.incrementAndGet();
        ex.getResponseHeaders().add("Location", to);
        ex.sendResponseHeaders(302, -1);
        ex.close();
    }

    private String url(String path) { return "http://127.0.0.1:" + port + path; }
    private File dest() { return new File(dir, "melk-10107.apk"); }
    private File part() { return new File(dir, "melk-10107.apk.part"); }
    private ApkDownloader dl(ApkDownloader.FreeSpace fs, int readMs) { return new ApkDownloader(fs, 2000, readMs, true, f -> new FileOutputStream(f)); }

    private UpdateException expect(ApkDownloader d, String path, String hash, long size, AtomicBoolean cancel) {
        try {
            d.download(url(path), dest(), hash, size, null, cancel);
        } catch (UpdateException e) {
            assertFalse("no partial file may be left", part().exists());
            assertFalse("no final file may be left", dest().exists());
            return e;
        }
        fail("expected an UpdateException for " + path);
        return null;
    }

    // ---------- success ----------

    @Test
    public void downloadsVerifiesAndReportsProgressFromZeroTo100() throws Exception {
        final List<Integer> pcts = new ArrayList<>();
        ApkDownloader.Result r = dl(PLENTY, 5000).download(url("/slow.apk"), dest(), sha, body.length, (done, total, pct) -> pcts.add(pct), null);
        assertEquals(sha, r.sha256);
        assertEquals(body.length, r.bytes);
        assertFalse(r.fromCache);
        assertEquals(Hashes.sha256OfBytes(body), Hashes.sha256OfFile(dest()));
        assertFalse(part().exists());
        assertEquals(Integer.valueOf(0), pcts.get(0));
        assertEquals(Integer.valueOf(100), pcts.get(pcts.size() - 1));
        assertTrue("several progress steps expected, got " + pcts, pcts.size() >= 4);
        for (int i = 1; i < pcts.size(); i++) assertTrue("progress never goes backwards: " + pcts, pcts.get(i) >= pcts.get(i - 1));
        for (int p : pcts) assertTrue(p >= 0 && p <= 100);
        assertTrue("100 only after the file is verified and saved", pcts.indexOf(100) == pcts.size() - 1);
    }

    @Test
    public void upperCaseChecksumIsAccepted() throws Exception {
        assertEquals(sha, dl(PLENTY, 5000).download(url("/ok.apk"), dest(), sha.toUpperCase(), body.length, null, null).sha256);
    }

    @Test
    public void aFileThatAlreadyMatchesIsNotDownloadedAgain() throws Exception {
        dl(PLENTY, 5000).download(url("/ok.apk"), dest(), sha, body.length, null, null);
        assertEquals(1, hits.get());
        final List<Integer> pcts = new ArrayList<>();
        ApkDownloader.Result r = dl(PLENTY, 5000).download(url("/ok.apk"), dest(), sha, body.length, (d, t, p) -> pcts.add(p), null);
        assertTrue(r.fromCache);
        assertEquals("no second request", 1, hits.get());
        assertEquals(Integer.valueOf(100), pcts.get(pcts.size() - 1));
    }

    @Test
    public void aCorruptLeftoverIsReplaced() throws Exception {
        Files.write(dest().toPath(), new byte[] {1, 2, 3});
        ApkDownloader.Result r = dl(PLENTY, 5000).download(url("/ok.apk"), dest(), sha, body.length, null, null);
        assertFalse(r.fromCache);
        assertEquals(sha, Hashes.sha256OfFile(dest()));
    }

    @Test
    public void followsARedirectOnTheSameHost() throws Exception {
        assertEquals(sha, dl(PLENTY, 5000).download(url("/redir"), dest(), sha, body.length, null, null).sha256);
    }

    // ---------- integrity ----------

    @Test
    public void aTamperedFileIsRejectedByChecksum() {
        UpdateException e = expect(dl(PLENTY, 5000), "/bad.apk", sha, body.length, null);
        assertEquals(UpdateException.CHECKSUM_MISMATCH, e.code);
    }

    @Test
    public void aServerFileOfADifferentSizeIsRejectedBeforeDownloading() {
        UpdateException e = expect(dl(PLENTY, 5000), "/short-header.apk", sha, body.length, null);
        assertEquals(UpdateException.SIZE_MISMATCH, e.code);
    }

    @Test
    public void moreDataThanPromisedStopsTheDownload() {
        UpdateException e = expect(dl(PLENTY, 5000), "/long.apk", sha, body.length, null);
        assertEquals(UpdateException.SIZE_MISMATCH, e.code);
    }

    @Test
    public void anAbsurdlyLargeFileIsRefused() {
        UpdateException e = expect(dl(PLENTY, 5000), "/huge.apk", sha, body.length, null);
        assertEquals(UpdateException.TOO_LARGE, e.code);
    }

    // ---------- cancellation ----------

    @Test
    public void cancellingMidDownloadStopsAndCleansUp() {
        final AtomicBoolean cancel = new AtomicBoolean(false);
        try {
            dl(PLENTY, 5000).download(url("/slow.apk"), dest(), sha, body.length, (d, t, p) -> { if (p >= 10) cancel.set(true); }, cancel);
            fail("expected CANCELLED");
        } catch (UpdateException e) {
            assertEquals(UpdateException.CANCELLED, e.code);
        }
        assertFalse(part().exists());
        assertFalse(dest().exists());
    }

    @Test
    public void cancellingBeforeStartMakesNoRequest() {
        AtomicBoolean cancel = new AtomicBoolean(true);
        UpdateException e = expect(dl(PLENTY, 5000), "/ok.apk", sha, body.length, cancel);
        assertEquals(UpdateException.CANCELLED, e.code);
        assertEquals(0, hits.get());
    }

    // ---------- network ----------

    @Test
    public void aConnectionDroppedMidDownloadIsANetworkError() {
        UpdateException e = expect(dl(PLENTY, 5000), "/cut.apk", sha, body.length, null);
        assertEquals(UpdateException.NETWORK, e.code);
    }

    @Test
    public void aStalledServerTimesOut() {
        long t0 = System.currentTimeMillis();
        UpdateException e = expect(dl(PLENTY, 600), "/stall.apk", sha, body.length, null);
        assertEquals(UpdateException.NETWORK_TIMEOUT, e.code);
        assertTrue("must give up well before the server unblocks", System.currentTimeMillis() - t0 < 2500);
    }

    @Test
    public void notFoundIsReportedAsAnHttpError() {
        UpdateException e = expect(dl(PLENTY, 5000), "/missing", sha, body.length, null);
        assertEquals(UpdateException.HTTP_ERROR, e.code);
        assertTrue(e.getMessage().contains("404"));
    }

    @Test
    public void anUnreachableServerIsANetworkError() throws Exception {
        int closed;
        try (ServerSocket s = new ServerSocket(0, 1, InetAddress.getLoopbackAddress())) { closed = s.getLocalPort(); }
        try {
            dl(PLENTY, 1000).download("http://127.0.0.1:" + closed + "/x.apk", dest(), sha, body.length, null, null);
            fail("expected NETWORK");
        } catch (UpdateException e) {
            assertEquals(UpdateException.NETWORK, e.code);
        }
    }

    @Test
    public void aRedirectLoopGivesUp() {
        assertEquals(UpdateException.NETWORK, expect(dl(PLENTY, 5000), "/redir-loop", sha, body.length, null).code);
    }

    @Test
    public void aRedirectToACleartextOutsideHostIsRefused() {
        assertEquals(UpdateException.BAD_URL, expect(dl(PLENTY, 5000), "/redir-out", sha, body.length, null).code);
    }

    // ---------- storage ----------

    @Test
    public void tooLittleFreeSpaceStopsBeforeAnyDownload() {
        UpdateException e = expect(dl(d -> 10L * 1024 * 1024, 5000), "/ok.apk", sha, body.length, null);
        assertEquals(UpdateException.NO_SPACE, e.code);
        assertTrue(e.getMessage().contains("MB"));
        assertEquals("no request is made when storage is short", 0, hits.get());
    }

    @Test
    public void spaceForTheFileAloneIsNotEnough() {
        // the install needs headroom: file size + 32 MB
        long justTheFile = body.length + 1_000_000L;
        assertEquals(UpdateException.NO_SPACE, expect(dl(d -> justTheFile, 5000), "/ok.apk", sha, body.length, null).code);
    }

    @Test
    public void aDiskThatFillsUpWhileWritingIsReportedAsNoSpace() {
        ApkDownloader d = new ApkDownloader(PLENTY, 2000, 5000, true, f -> new FileOutputStream(f) {
            private long n;
            @Override public void write(byte[] b, int off, int len) throws IOException {
                n += len;
                if (n > 100_000) throw new IOException("write failed: ENOSPC (No space left on device)");
                super.write(b, off, len);
            }
        });
        UpdateException e = expect(d, "/ok.apk", sha, body.length, null);
        assertEquals(UpdateException.NO_SPACE, e.code);
    }

    @Test
    public void anUnreadableFreeSpaceProbeDoesNotBlockTheUpdate() throws Exception {
        assertEquals(sha, dl(d -> { throw new IOException("statfs failed"); }, 5000).download(url("/ok.apk"), dest(), sha, body.length, null, null).sha256);
    }

    // ---------- arguments and URL rules ----------

    @Test
    public void productionModeRefusesEveryNonHttpsAddress() {
        ApkDownloader prod = ApkDownloader.forProduction(PLENTY);
        for (String bad : new String[] {url("/ok.apk"), "ftp://example.com/a.apk", "file:///data/a.apk", "https://user:pw@example.com/a.apk", "not a url", "https:///a.apk"}) {
            try {
                prod.download(bad, dest(), sha, body.length, null, null);
                fail("accepted " + bad);
            } catch (UpdateException e) {
                assertEquals(bad, UpdateException.BAD_URL, e.code);
            }
        }
        assertEquals("nothing reached the test server", 0, hits.get());
    }

    @Test
    public void badArgumentsAreRefused() {
        assertEquals(UpdateException.BAD_ARGS, expect(dl(PLENTY, 5000), "/ok.apk", "xyz", body.length, null).code);
        assertEquals(UpdateException.BAD_ARGS, expect(dl(PLENTY, 5000), "/ok.apk", null, body.length, null).code);
        assertEquals(UpdateException.BAD_ARGS, expect(dl(PLENTY, 5000), "/ok.apk", sha, 0, null).code);
        assertEquals(UpdateException.TOO_LARGE, expect(dl(PLENTY, 5000), "/ok.apk", sha, ApkDownloader.MAX_APK_BYTES + 1, null).code);
        assertEquals(0, hits.get());
    }
}
