package com.bleled.com;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.nio.file.Files;
import org.junit.Test;

public class HashesTest {
    @Test public void knownSha256Vectors() {
        assertEquals("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", Hashes.sha256OfBytes(new byte[0]));
        assertEquals("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", Hashes.sha256OfBytes("abc".getBytes()));
    }
    @Test public void fileHashMatchesBytesHash() throws Exception {
        File f = File.createTempFile("hash", ".bin");
        byte[] data = new byte[300_000];
        new java.util.Random(7).nextBytes(data);
        Files.write(f.toPath(), data);
        assertEquals(Hashes.sha256OfBytes(data), Hashes.sha256OfFile(f));
        f.delete();
    }
    @Test public void sha256Validation() {
        assertTrue(Hashes.isSha256("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"));
        assertTrue(Hashes.isSha256("E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855"));
        assertFalse(Hashes.isSha256("e3b0"));
        assertFalse(Hashes.isSha256(null));
        assertFalse(Hashes.isSha256("g3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"));
    }
}
