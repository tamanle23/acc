package com.unipost.fw.tracking;

import com.unipost.core.context.Context;
import com.unipost.core.io.ContextHeader;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.ZonedDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

class DistributedTracingMdcTest {

    private ContextFilter contextFilter;
    private Context mockContext;

    @BeforeEach
    void setUp() {
        MDC.clear();
        mockContext = new Context() {
            private ContextHeader header;

            @Override
            public void init(String contextKey) {}

            @Override
            public String getKey() { return null; }

            @Override
            public String getAuthenticationUser() { return null; }

            @Override
            public boolean isSuper() { return false; }

            @Override
            public List<String> getAuthorities() { return List.of(); }

            @Override
            public ContextHeader createHeader(String applicationName, String clientType) {
                this.header = ContextHeader.builder()
                        .application(applicationName)
                        .clientType(clientType)
                        .transactionId("tx-123")
                        .requestId("req-456")
                        .build();
                return this.header;
            }

            @Override
            public ContextHeader getHeader() { return this.header; }

            @Override
            public void clear() { this.header = null; }

            @Override
            public void setRequestHeader(ContextHeader currentContext) { this.header = currentContext; }

            @Override
            public boolean checkPermission(String resource, String permission) { return true; }

            @Override
            public boolean checkPermissions(String resource, List<String> permissions) { return true; }

            @Override
            public boolean checkPermission(String permission) { return true; }

            @Override
            public boolean checkPermissions(List<String> permission) { return true; }
        };

        contextFilter = new ContextFilter(mockContext, "unipost-backend-test");
    }

    @AfterEach
    void tearDown() {
        MDC.clear();
    }

    @Test
    void testExtractsIncomingW3CTraceparentAndPopulatesMdc() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/metadata/records");
        String incomingTraceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
        request.addHeader("traceparent", incomingTraceparent);
        request.addHeader("X-Tenant-Id", "tenant-alpha");
        request.addHeader("X-Workspace-Id", "ws-omega");
        request.addHeader("X-USER-ID", "alice-architect");

        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<String> capturedTraceId = new AtomicReference<>();
        AtomicReference<String> capturedTenantId = new AtomicReference<>();
        AtomicReference<String> capturedWorkspaceId = new AtomicReference<>();
        AtomicReference<String> capturedUserId = new AtomicReference<>();

        MockFilterChain filterChain = new MockFilterChain();

        contextFilter.doFilter(request, response, (req, res) -> {
            capturedTraceId.set(MDC.get("trace_id"));
            capturedTenantId.set(MDC.get("tenant_id"));
            capturedWorkspaceId.set(MDC.get("workspace_id"));
            capturedUserId.set(MDC.get("user_id"));
        });

        assertEquals("4bf92f3577b34da6a3ce929d0e0e4736", capturedTraceId.get());
        assertEquals("tenant-alpha", capturedTenantId.get());
        assertEquals("ws-omega", capturedWorkspaceId.get());
        assertEquals("alice-architect", capturedUserId.get());

        // Response should echo traceparent header
        assertEquals(incomingTraceparent, response.getHeader("traceparent"));

        // MDC must be cleared post-filter execution
        assertNull(MDC.get("trace_id"));
        assertNull(MDC.get("tenant_id"));
        assertNull(MDC.get("workspace_id"));
        assertNull(MDC.get("user_id"));
    }

    @Test
    void testGeneratesW3CTraceparentWhenHeaderAbsent() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/metadata/records");
        MockHttpServletResponse response = new MockHttpServletResponse();
        AtomicReference<String> capturedTraceId = new AtomicReference<>();

        contextFilter.doFilter(request, response, (req, res) -> {
            capturedTraceId.set(MDC.get("trace_id"));
        });

        assertNotNull(capturedTraceId.get());
        assertEquals(32, capturedTraceId.get().length());

        String responseTraceparent = response.getHeader("traceparent");
        assertNotNull(responseTraceparent);
        assertTrue(responseTraceparent.startsWith("00-" + capturedTraceId.get()));
        assertTrue(responseTraceparent.endsWith("-01"));
    }
}
