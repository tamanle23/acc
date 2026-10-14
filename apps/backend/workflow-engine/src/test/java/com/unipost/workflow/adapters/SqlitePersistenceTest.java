package com.unipost.workflow.adapters;

import com.unipost.workflow.adapters.storage.SqliteJdbcPersistenceAdapter;
import com.unipost.workflow.ports.PersistencePort;
import org.junit.jupiter.api.io.TempDir;

import java.io.File;
import java.nio.file.Path;

class SqlitePersistenceTest extends PersistenceContractTest {

    @TempDir
    Path tempDir;

    @Override
    protected PersistencePort createPersistencePort() {
        File dbFile = tempDir.resolve("test_workflow.db").toFile();
        return new SqliteJdbcPersistenceAdapter("jdbc:sqlite:" + dbFile.getAbsolutePath());
    }
}
