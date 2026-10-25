package com.acc.presentation;

import com.acc.core.context.Context;
import com.acc.core.io.ContextHeader;
import com.acc.core.io.Page;
import com.acc.core.io.PageRequest;
import com.acc.core.io.ResponseWrapper;
import com.acc.domain.metadata.EntityType;
import com.acc.fw.ResponseEntityBuilder;
import com.acc.presentation.dto.metadata.EntityRecordResponse;
import com.acc.repository.jpa.EntityTypeRepository;
import com.acc.service.MetadataService;
import com.acc.service.exception.MetadataNotFoundException;
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

    @Test
    void testResolveEntityType_ByNumericId() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(articleType));

        Page<EntityRecordResponse> mockPage = new Page<>();
        when(metadataService.getEntityRecords(eq(10L), any(PageRequest.class), anyMap(), eq("createdDate"), eq("desc"), eq(TENANT_ID)))
                .thenReturn(mockPage);

        Map<String, String> params = new HashMap<>();
        params.put("filter[title]", "Hello");
        params.put("filter[status]", "SOMETHING");

        ResponseEntity<ResponseWrapper<ContextHeader, Page<EntityRecordResponse>>> response =
                controller.getPublishedRecords(TENANT_ID, "10", null, "createdDate,desc", params);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(entityTypeRepository).findByIdAndDeletedDateIsNull(10L);
    }

    @Test
    void testResolveEntityType_ByGlobalSystemName() {
        when(entityTypeRepository.findByTenantIdAndSystemNameAndDeletedDateIsNull(TENANT_ID, "global_news"))
                .thenReturn(Optional.empty());
        when(entityTypeRepository.findBySystemNameAndDeletedDateIsNull("global_news"))
                .thenReturn(Optional.of(articleType));

        Page<EntityRecordResponse> mockPage = new Page<>();
        when(metadataService.getEntityRecords(eq(10L), any(PageRequest.class), anyMap(), eq("title"), eq("asc"), eq(TENANT_ID)))
                .thenReturn(mockPage);

        ResponseEntity<ResponseWrapper<ContextHeader, Page<EntityRecordResponse>>> response =
                controller.getPublishedRecords(TENANT_ID, "global_news", null, "title", Map.of());

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(entityTypeRepository).findBySystemNameAndDeletedDateIsNull("global_news");
    }

    @Test
    void testResolveEntityType_Errors() {
        assertThrows(MetadataNotFoundException.class, () -> controller.getPublishedRecords(TENANT_ID, null, null, null, Map.of()));
        assertThrows(MetadataNotFoundException.class, () -> controller.getPublishedRecords(TENANT_ID, "", null, null, Map.of()));

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(999L)).thenReturn(Optional.empty());
        assertThrows(MetadataNotFoundException.class, () -> controller.getPublishedRecords(TENANT_ID, "999", null, null, Map.of()));

        when(entityTypeRepository.findByTenantIdAndSystemNameAndDeletedDateIsNull(TENANT_ID, "unknown")).thenReturn(Optional.empty());
        when(entityTypeRepository.findBySystemNameAndDeletedDateIsNull("unknown")).thenReturn(Optional.empty());
        assertThrows(MetadataNotFoundException.class, () -> controller.getPublishedRecords(TENANT_ID, "unknown", null, null, Map.of()));
    }
}
