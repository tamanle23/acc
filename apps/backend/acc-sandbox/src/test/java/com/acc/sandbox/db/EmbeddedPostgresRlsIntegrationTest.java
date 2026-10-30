package com.acc.sandbox.db;

import com.acc.fw.tenancy.TenantContextHolder;
import com.acc.fw.tenancy.TenantSessionAspect;
import com.acc.sandbox.config.SandboxProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.io.File;
import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EmbeddedPostgresRlsIntegrationTest {

    @BeforeEach
    void setUp() {
        TenantContextHolder.clear();
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    @DisplayName("In TEST mode, embedded PostgreSQL datasource configuration initializes properly")
    void testTestModeDatasourceIsEphemeral() {
        SandboxProperties props = new SandboxProperties();
        props.setEnabled(true);
        props.setMode(SandboxProperties.SandboxMode.TEST);

        EmbeddedPostgresDatasourceConfiguration config = new EmbeddedPostgresDatasourceConfiguration(props);
        DataSource ds = config.createDataSource("jdbc:postgresql://localhost:54329/postgres");
        assertNotNull(ds);
    }

    @Test
    @DisplayName("In DEV mode with pristine=false, persistent storage must be preserved across restarts")
    void testDevModePersistentPreservesStorage() throws IOException {
        String testStoragePath = "target/test-scratch/dev-persistent";
        File dir = new File(testStoragePath);
        dir.mkdirs();
        File sentinel = new File(dir, "sentinel.txt");
        sentinel.createNewFile();
        assertTrue(sentinel.exists());

        SandboxProperties props = new SandboxProperties();
        props.setEnabled(true);
        props.setMode(SandboxProperties.SandboxMode.DEV);
        props.getDev().setPristine(false);
        props.getDatabase().setDevStoragePath(testStoragePath);

        EmbeddedPostgresDatasourceConfiguration config = new EmbeddedPostgresDatasourceConfiguration(props);
        config.purgePristineStorageIfConfigured();

        // Sentinel file MUST still exist because pristine is false
        assertTrue(sentinel.exists(), "Persistent storage must be preserved in DEV mode when pristine=false");
    }

    @Test
    @DisplayName("In DEV mode with pristine=true, scratch storage must be wiped clean on startup")
    void testDevModePristineWipesStorage() throws IOException {
        String testStoragePath = "target/test-scratch/dev-pristine";
        File dir = new File(testStoragePath);
        dir.mkdirs();
        File sentinel = new File(dir, "sentinel.txt");
        sentinel.createNewFile();
        assertTrue(sentinel.exists());

        SandboxProperties props = new SandboxProperties();
        props.setEnabled(true);
        props.setMode(SandboxProperties.SandboxMode.DEV);
        props.getDev().setPristine(true);
        props.getDatabase().setDevStoragePath(testStoragePath);

        EmbeddedPostgresDatasourceConfiguration config = new EmbeddedPostgresDatasourceConfiguration(props);
        config.purgePristineStorageIfConfigured();

        // Sentinel file MUST be wiped because pristine is true
        assertFalse(sentinel.exists(), "Scratch directory must be wiped clean in DEV mode when pristine=true");
    }

    @Test
    @DisplayName("TenantSessionAspect should correctly execute PostgreSQL RLS session parameters")
    void testTenantSessionAspectSetsSessionSetting() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        TenantSessionAspect aspect = new TenantSessionAspect(jdbcTemplate);

        TenantContextHolder.setTenantId("tenant-acme");
        aspect.setPostgresTenantSession();

        verify(jdbcTemplate, times(1)).execute("SET LOCAL app.current_tenant_id = 'tenant-acme'");
        verify(jdbcTemplate, times(1)).execute("SET LOCAL app.is_system_custodian = 'false'");
        verify(jdbcTemplate, times(1)).execute("SET LOCAL statement_timeout = '3000ms'");
    }

    @Test
    @DisplayName("TenantSessionAspect should set is_system_custodian=true when sovereign actor impersonates")
    void testTenantSessionAspectDualContextSovereign() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        TenantSessionAspect aspect = new TenantSessionAspect(jdbcTemplate);

        TenantContextHolder.setDualContext("tenant-acme", "SYSTEM");
        aspect.setPostgresTenantSession();

        verify(jdbcTemplate, times(1)).execute("SET LOCAL app.current_tenant_id = 'tenant-acme'");
        verify(jdbcTemplate, times(1)).execute("SET LOCAL app.is_system_custodian = 'true'");
        verify(jdbcTemplate, times(1)).execute("SET LOCAL statement_timeout = '3000ms'");
    }
}
