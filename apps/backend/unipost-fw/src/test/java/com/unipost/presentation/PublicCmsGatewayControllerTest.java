package com.unipost.presentation;

import com.unipost.core.context.Context;
import com.unipost.core.io.ContextHeader;
import com.unipost.core.io.Page;
import com.unipost.core.io.PageRequest;
import com.unipost.core.io.ResponseWrapper;
import com.unipost.domain.metadata.EntityType;
import com.unipost.fw.ResponseEntityBuilder;
import com.unipost.presentation.dto.metadata.EntityRecordResponse;
import com.unipost.repository.jpa.EntityTypeRepository;
import com.unipost.service.MetadataService;
import com.unipost.service.exception.MetadataNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PublicCmsGatewayControllerTest {

    @Mock
    private MetadataService metadataService;

    @Mock
    private EntityTypeRepository entityTypeRepository;

    @Mock
    private Context contextHelper;

    private ResponseEntityBuilder responseBuilder;
    private PublicCmsGatewayController controller;

    private static final String TENANT_ID = "tenant-alpha";
    private EntityType articleType;

    @BeforeEach
    void setUp() {
        responseBuilder = new ResponseEntityBuilder();
        ReflectionTestUtils.setField(responseBuilder, "contextHelper", contextHelper);
        controller = new PublicCmsGatewayController(metadataService, entityTypeRepository, responseBuilder);

        articleType = new EntityType();
        articleType.setId(10L);
        articleType.setName("Article");
        articleType.setSystemName("article");
        articleType.setTenantId(TENANT_ID);
    }

    @Test
    void testGetPublishedRecords_EnforcesPublishedStatusFilter() {
        when(entityTypeRepository.findByTenantIdAndSystemNameAndDeletedDateIsNull(TENANT_ID, "article"))
                .thenReturn(Optional.of(articleType));

        Page<EntityRecordResponse> mockPage = new Page<>();
        when(metadataService.getEntityRecords(eq(10L), any(PageRequest.class), anyMap(), isNull(), eq("asc"), eq(TENANT_ID)))
                .thenReturn(mockPage);

        Map<String, String> params = new HashMap<>();
        params.put("filter[category][eq]", "tech");
        // Attempt to override status to DRAFT
        params.put("filter[status][eq]", "DRAFT");

        ResponseEntity<ResponseWrapper<ContextHeader, Page<EntityRecordResponse>>> response =
                controller.getPublishedRecords(TENANT_ID, "article", null, null, params);

        assertEquals(HttpStatus.OK, response.getStatusCode());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Map<String, String>>> filterCaptor = ArgumentCaptor.forClass(Map.class);
        verify(metadataService).getEntityRecords(eq(10L), any(PageRequest.class), filterCaptor.capture(), isNull(), eq("asc"), eq(TENANT_ID));

        Map<String, Map<String, String>> appliedFilters = filterCaptor.getValue();
        assertNotNull(appliedFilters.get("status"));
        // Status filter MUST be locked to PUBLISHED
        assertEquals("PUBLISHED", appliedFilters.get("status").get("eq"));
        assertEquals("tech", appliedFilters.get("category").get("eq"));
    }

    @Test
    void testGetPublishedRecord_ReturnsPublishedRecordSuccessfully() {
        when(entityTypeRepository.findByTenantIdAndSystemNameAndDeletedDateIsNull(TENANT_ID, "article"))
                .thenReturn(Optional.of(articleType));

        EntityRecordResponse record = new EntityRecordResponse(
                100L,
                "uid-100",
                10L,
                TENANT_ID,
                1L,
                Map.of("title", "Hello World", "status", "PUBLISHED"),
                1L,
                LocalDateTime.now(),
                LocalDateTime.now()
        );
        when(metadataService.getEntityRecord(10L, 100L)).thenReturn(record);

        ResponseEntity<ResponseWrapper<ContextHeader, EntityRecordResponse>> response =
                controller.getPublishedRecord(TENANT_ID, 100L, "article");

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("Hello World", response.getBody().getBody().attributes().get("title"));
    }

    @Test
    void testGetPublishedRecord_ThrowsNotFoundWhenRecordIsDraft() {
        when(entityTypeRepository.findByTenantIdAndSystemNameAndDeletedDateIsNull(TENANT_ID, "article"))
                .thenReturn(Optional.of(articleType));

        EntityRecordResponse draftRecord = new EntityRecordResponse(
                101L,
                "uid-101",
                10L,
                TENANT_ID,
                1L,
                Map.of("title", "Draft Post", "status", "DRAFT"),
                1L,
                LocalDateTime.now(),
                LocalDateTime.now()
        );
        when(metadataService.getEntityRecord(10L, 101L)).thenReturn(draftRecord);

        assertThrows(MetadataNotFoundException.class, () -> {
            controller.getPublishedRecord(TENANT_ID, 101L, "article");
        });
    }

    @Test
    void testGetPublishedRecord_ThrowsNotFoundWhenTenantMismatch() {
        when(entityTypeRepository.findByTenantIdAndSystemNameAndDeletedDateIsNull(TENANT_ID, "article"))
                .thenReturn(Optional.of(articleType));

        EntityRecordResponse recordAlienTenant = new EntityRecordResponse(
                102L,
                "uid-102",
                10L,
                "alien-tenant",
                1L,
                Map.of("title", "Secret Alien Post", "status", "PUBLISHED"),
                1L,
                LocalDateTime.now(),
                LocalDateTime.now()
        );
        when(metadataService.getEntityRecord(10L, 102L)).thenReturn(recordAlienTenant);

        assertThrows(MetadataNotFoundException.class, () -> {
            controller.getPublishedRecord(TENANT_ID, 102L, "article");
        });
    }
}
