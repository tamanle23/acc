package com.unipost.sandbox.simulators;

import com.unipost.fs.model.FileAttributes;
import com.unipost.fs.model.FileConnector;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.Resource;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

class InMemoryStorageConnectorTest {

    private InMemoryStorageConnector connector;
    private InMemoryStorageSimulator simulator;

    @BeforeEach
    void setUp() {
        simulator = new InMemoryStorageSimulator();
        connector = new InMemoryStorageConnector(simulator);
    }

    @Test
    @DisplayName("Should store input stream and load as resource")
    void shouldStoreAndLoadResource() throws Exception {
        byte[] payload = "Test storage payload".getBytes(StandardCharsets.UTF_8);
        InputStream stream = new ByteArrayInputStream(payload);

        FileAttributes attr = connector.store(stream, payload.length, "DOCS_123");
        assertNotNull(attr);
        assertEquals("DOCS_123", attr.getCode());
        assertEquals(FileConnector.S3, connector.getConnector());

        Resource res = connector.loadAsResource(attr);
        assertNotNull(res);
        byte[] readBack = res.getInputStream().readAllBytes();
        assertArrayEquals(payload, readBack);

        // Remove
        connector.remove(attr);
        Resource afterDelete = connector.loadAsResource(attr);
        assertEquals(0, afterDelete.getInputStream().readAllBytes().length);
    }
}
