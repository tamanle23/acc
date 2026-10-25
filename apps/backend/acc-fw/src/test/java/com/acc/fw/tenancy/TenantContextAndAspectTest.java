package com.acc.fw.tenancy;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TenantContextAndAspectTest {

    private JdbcTemplate jdbcTemplate;
    private TenantSessionAspect tenantSessionAspect;

    @BeforeEach
    void setUp() {
        jdbcTemplate = Mockito.mock(JdbcTemplate.class);
        tenantSessionAspect = new TenantSessionAspect(jdbcTemplate);
        TenantContextHolder.clear();
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    void testTenantContextHolderStorageAndClear() {
        assertNull(TenantContextHolder.getTenantId());

        TenantContextHolder.setTenantId("tenant-acme");
        assertEquals("tenant-acme", TenantContextHolder.getTenantId());

        TenantContextHolder.clear();
        assertNull(TenantContextHolder.getTenantId());
    }

    @Test
    void testTenantSessionAspectSetsSessionSetting() {
        TenantContextHolder.setTenantId("tenant-acme");

        tenantSessionAspect.setPostgresTenantSession();

        verify(jdbcTemplate, times(1)).execute("SET LOCAL app.current_tenant_id = 'tenant-acme'");
        verify(jdbcTemplate, times(1)).execute("SET LOCAL app.is_system_custodian = 'false'");
        verify(jdbcTemplate, times(1)).execute("SET LOCAL statement_timeout = '3000ms'");
    }

    @Test
    void testTenantSessionAspectSetsSystemCustodianWhenSystemActor() {
        TenantContextHolder.setDualContext("tenant-acme", "SYSTEM");

        assertTrue(TenantContextHolder.isImpersonating());
        assertTrue(TenantContextHolder.isSovereignActor());
        assertEquals("tenant-acme", TenantContextHolder.getTenantId());
        assertEquals("SYSTEM", TenantContextHolder.getActorTenantId());

        tenantSessionAspect.setPostgresTenantSession();

        verify(jdbcTemplate, times(1)).execute("SET LOCAL app.current_tenant_id = 'tenant-acme'");
        verify(jdbcTemplate, times(1)).execute("SET LOCAL app.is_system_custodian = 'true'");
        verify(jdbcTemplate, times(1)).execute("SET LOCAL statement_timeout = '3000ms'");
    }

    @Test
    void testTenantSessionAspectSetsSystemCustodianWhenDirectSystemTenant() {
        TenantContextHolder.setTenantId("SYSTEM");

        assertFalse(TenantContextHolder.isImpersonating());
        assertTrue(TenantContextHolder.isSovereignActor());
        assertEquals("SYSTEM", TenantContextHolder.getTenantId());

        tenantSessionAspect.setPostgresTenantSession();

        verify(jdbcTemplate, times(1)).execute("SET LOCAL app.current_tenant_id = 'SYSTEM'");
        verify(jdbcTemplate, times(1)).execute("SET LOCAL app.is_system_custodian = 'true'");
    }

    @Test
    void testTenantSessionAspectNoopWhenNullOrEmpty() {
        TenantContextHolder.setTenantId(null);
        tenantSessionAspect.setPostgresTenantSession();

        TenantContextHolder.setTenantId("   ");
        tenantSessionAspect.setPostgresTenantSession();

        verifyNoInteractions(jdbcTemplate);
    }

    @Test
    void testTenantSessionAspectRejectsInvalidTenantId() {
        TenantContextHolder.setTenantId("tenant'; DROP TABLE UNIPOST_ENTITIES; --");

        assertThrows(IllegalArgumentException.class, () -> {
            tenantSessionAspect.setPostgresTenantSession();
        });

        verifyNoInteractions(jdbcTemplate);
    }
}
