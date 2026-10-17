package com.unipost.presentation;

import com.unipost.core.context.Context;
import com.unipost.core.io.ContextHeader;
import com.unipost.core.io.ResponseWrapper;
import com.unipost.fw.ResponseEntityBuilder;
import com.unipost.tenant.export.TenantExportService;
import com.unipost.tenant.purge.CertificateOfErasure;
import com.unipost.tenant.purge.TenantPurgeService;
import jakarta.servlet.ServletOutputStream;
import jakarta.servlet.WriteListener;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TenantDataLifecycleControllerTest {

    @Mock
    private TenantExportService tenantExportService;

    @Mock
    private TenantPurgeService tenantPurgeService;

    @Mock
    private Context contextHelper;

    private ResponseEntityBuilder responseBuilder;
    private TenantDataLifecycleController controller;

    @BeforeEach
    void setUp() {
        responseBuilder = new ResponseEntityBuilder();
        ReflectionTestUtils.setField(responseBuilder, "contextHelper", contextHelper);
        controller = new TenantDataLifecycleController(tenantExportService, tenantPurgeService, responseBuilder);
    }

    @Test
    void testExportTenantArchive() throws IOException {
        HttpServletResponse response = mock(HttpServletResponse.class);
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ServletOutputStream sos = new ServletOutputStream() {
            @Override
            public boolean isReady() { return true; }
            @Override
            public void setWriteListener(WriteListener writeListener) {}
            @Override
            public void write(int b) { baos.write(b); }
        };
        when(response.getOutputStream()).thenReturn(sos);

        doAnswer(inv -> {
            sos.write("dummy-zip".getBytes());
            return null;
        }).when(tenantExportService).streamTenantArchive(eq("tenant-corp"), eq(sos));

        controller.exportTenantArchive("tenant-corp", response);

        verify(response).setContentType("application/zip");
        verify(response).setHeader(eq("X-Tenant-Export-Version"), eq("1.0.0"));
        verify(response).flushBuffer();
        assertThat(baos.toByteArray()).isNotEmpty();
    }

    @Test
    void testExportTenantArchiveStream() throws Exception {
        ResponseEntity<StreamingResponseBody> response =
                controller.exportTenantArchiveStream("tenant-corp");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getContentType().toString()).isEqualTo("application/zip");
        assertThat(response.getHeaders().getFirst("X-Tenant-Export-Version")).isEqualTo("1.0.0");

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        response.getBody().writeTo(out);
        verify(tenantExportService).streamTenantArchive(eq("tenant-corp"), any());
    }

    @Test
    void testPurgeTenant() {
        Authentication auth = mock(Authentication.class);
        when(auth.getName()).thenReturn("super-admin");

        CertificateOfErasure cert = new CertificateOfErasure(
                "cert-123", "hash-corp", "2026-10-17T00:00:00Z",
                50L, 10L, 5L, 2L, 1L, "COMPLETED", "super-admin",
                "sha256-digest", "HMAC-SHA256", "signature-bytes"
        );
        when(tenantPurgeService.executeTenantPurge("tenant-corp", "super-admin")).thenReturn(cert);

        ResponseEntity<ResponseWrapper<ContextHeader, CertificateOfErasure>> response =
                controller.purgeTenant("tenant-corp", auth);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().getBody().certificateId()).isEqualTo("cert-123");
        assertThat(response.getBody().getBody().recordsDeleted()).isEqualTo(50L);
    }
}
