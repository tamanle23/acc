package com.acc.fs.domain.model;

import com.acc.core.domain.exception.DomainValidationException;
import com.acc.fs.domain.model.valobj.FileId;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class FsObjectAggregateTest {

    @Test
    @DisplayName("createNewFile creates valid file aggregate with metadata")
    void testCreateNewFile() {
        long now = System.currentTimeMillis();
        FsObjectAggregate file = FsObjectAggregate.createNewFile(
            "tenant-1", "workspace-1", "document.pdf", "folder-123",
            1024L, "application/pdf", "/storage/path/doc.pdf", "abc123hash", now
        );

        assertNotNull(file.getId());
        assertEquals("tenant-1", file.tenantId());
        assertEquals("workspace-1", file.workspaceId());
        assertEquals("document.pdf", file.name());
        assertEquals("folder-123", file.parentUid());
        assertFalse(file.isDirectory());
        assertEquals(1024L, file.sizeBytes());
        assertEquals("application/pdf", file.contentType());
        assertEquals("abc123hash", file.checksumSha256());
    }

    @Test
    @DisplayName("createDirectory creates directory with isDirectory = true and 0 bytes")
    void testCreateDirectory() {
        long now = System.currentTimeMillis();
        FsObjectAggregate dir = FsObjectAggregate.createDirectory(
            "tenant-1", "workspace-1", "MyFolder", null, now
        );

        assertTrue(dir.isDirectory());
        assertEquals(0L, dir.sizeBytes());
        assertEquals("application/x-directory", dir.contentType());
    }

    @Test
    @DisplayName("empty name throws DomainValidationException")
    void testEmptyNameThrows() {
        long now = System.currentTimeMillis();
        assertThrows(DomainValidationException.class, () ->
            FsObjectAggregate.createNewFile("tenant-1", "ws-1", "  ", null, 100L, "text/plain", "", null, now)
        );
    }

    @Test
    @DisplayName("negative size throws DomainValidationException")
    void testNegativeSizeThrows() {
        long now = System.currentTimeMillis();
        assertThrows(DomainValidationException.class, () ->
            FsObjectAggregate.createNewFile("tenant-1", "ws-1", "file.txt", null, -5L, "text/plain", "", null, now)
        );
    }

    @Test
    @DisplayName("rename updates name and updatedAtEpochMs")
    void testRename() {
        long now = System.currentTimeMillis();
        FsObjectAggregate file = FsObjectAggregate.createNewFile(
            "tenant-1", "ws-1", "oldName.txt", null, 10L, "text/plain", "", null, now
        );

        file.rename("newName.txt", now + 500);
        assertEquals("newName.txt", file.name());
        assertEquals(now + 500, file.updatedAtEpochMs());
    }
}
