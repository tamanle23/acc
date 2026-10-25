package com.acc.sandbox.simulators;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class InMemoryStorageSimulatorTest {

    private InMemoryStorageSimulator storage;

    @BeforeEach
    void setUp() {
        storage = new InMemoryStorageSimulator();
    }

    @Test
    @DisplayName("Should store, retrieve and delete objects in memory")
    void shouldStoreAndRetrieveObjects() throws Exception {
        byte[] data = "Hello Unipost Sandbox".getBytes(StandardCharsets.UTF_8);
        InMemoryStorageSimulator.StoredObject obj = storage.putObject("test-bucket", "docs/test.txt", data, "text/plain");

        assertNotNull(obj);
        assertEquals("test-bucket", obj.bucket());
        assertEquals("docs/test.txt", obj.key());
        assertEquals(data.length, obj.sizeBytes());
        assertTrue(storage.exists("test-bucket", "docs/test.txt"));

        Optional<InputStream> streamOpt = storage.getObjectStream("test-bucket", "docs/test.txt");
        assertTrue(streamOpt.isPresent());
        byte[] retrieved = streamOpt.get().readAllBytes();
        assertArrayEquals(data, retrieved);

        boolean deleted = storage.deleteObject("test-bucket", "docs/test.txt");
        assertTrue(deleted);
        assertFalse(storage.exists("test-bucket", "docs/test.txt"));
    }

    @Test
    @DisplayName("Should clear all stored objects on reset")
    void shouldResetStorage() {
        storage.putObject("b1", "k1", new byte[]{1, 2}, "bin");
        storage.putObject("b2", "k2", new byte[]{3, 4}, "bin");
        assertEquals(2, (int) storage.getDiagnostics().get("totalFiles"));

        storage.reset();
        assertEquals(0, (int) storage.getDiagnostics().get("totalFiles"));
        assertFalse(storage.exists("b1", "k1"));
    }
}
