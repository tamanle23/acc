package com.unipost.presentation;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.unipost.core.context.Context;
import com.unipost.core.io.ContextHeader;
import com.unipost.core.io.Page;
import com.unipost.core.io.PageRequest;
import com.unipost.core.io.ResponseWrapper;
import com.unipost.fw.ResponseEntityBuilder;
import com.unipost.presentation.dto.metadata.ChildQueryOptions;
import com.unipost.presentation.dto.metadata.CompositeRecordResponse;
import com.unipost.service.CompositeRecordService;
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
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CompositeEntityControllerTest {

    @Mock
    private CompositeRecordService compositeRecordService;

    @Mock
    private Context contextHelper;

    private ObjectMapper objectMapper;
    private ResponseEntityBuilder responseBuilder;
    private CompositeEntityController controller;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        responseBuilder = new ResponseEntityBuilder();
        ReflectionTestUtils.setField(responseBuilder, "contextHelper", contextHelper);
        controller = new CompositeEntityController(compositeRecordService, responseBuilder, objectMapper);
    }

    @Test
    void testGetCompositeRecords_WithLegacyQueryParams() {
        CompositeRecordResponse record = new CompositeRecordResponse(
                1L, "tenant-test", 10L, true, 1L,
                Map.of("name", "Acme"), Collections.emptyMap(),
                "dynamic-sql-pushdown", LocalDateTime.now(), LocalDateTime.now()
        );

        Page<CompositeRecordResponse> mockPage = new Page<>();
        mockPage.setContent(List.of(record));
        mockPage.setNumber(1);
        mockPage.setSize(10);
        mockPage.setTotalPages(1L);
        mockPage.setTotalElements(1L);

        when(compositeRecordService.getCompositeRecordsPageWithOptions(eq(100L), any(), anyMap()))
                .thenReturn(mockPage);

        Map<String, String> queryParams = Map.of(
                "childLimit[orders]", "5",
                "childOffset[orders]", "10"
        );

        PageRequest pageRequest = new PageRequest();
        pageRequest.setNumber(1);
        pageRequest.setSize(10);

        ResponseEntity<ResponseWrapper<ContextHeader, Page<CompositeRecordResponse>>> response =
                controller.getCompositeRecords(100L, pageRequest, queryParams);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getFirst("X-Composite-Engine")).isEqualTo("dynamic-sql-pushdown");
        assertThat(response.getBody().getBody().getContent()).hasSize(1);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, ChildQueryOptions>> captor = ArgumentCaptor.forClass(Map.class);
        verify(compositeRecordService).getCompositeRecordsPageWithOptions(eq(100L), any(), captor.capture());

        Map<String, ChildQueryOptions> childQueries = captor.getValue();
        assertThat(childQueries).containsKey("orders");
        assertThat(childQueries.get("orders").limit()).isEqualTo(5);
        assertThat(childQueries.get("orders").offset()).isEqualTo(10);
    }

    @Test
    void testGetCompositeRecords_WithJsonChildQueries() {
        Page<CompositeRecordResponse> mockPage = new Page<>();
        mockPage.setContent(Collections.emptyList());
        mockPage.setNumber(1);
        mockPage.setSize(10);
        mockPage.setTotalPages(0L);
        mockPage.setTotalElements(0L);

        when(compositeRecordService.getCompositeRecordsPageWithOptions(eq(100L), any(), anyMap()))
                .thenReturn(mockPage);

        Map<String, String> queryParams = Map.of(
                "childQueries", "{\"orders\":{\"limit\":20,\"offset\":0}}"
        );

        ResponseEntity<ResponseWrapper<ContextHeader, Page<CompositeRecordResponse>>> response =
                controller.getCompositeRecords(100L, null, queryParams);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getFirst("X-Composite-Engine")).isEqualTo("dynamic-sql-pushdown");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, ChildQueryOptions>> captor = ArgumentCaptor.forClass(Map.class);
        verify(compositeRecordService).getCompositeRecordsPageWithOptions(eq(100L), any(), captor.capture());

        Map<String, ChildQueryOptions> childQueries = captor.getValue();
        assertThat(childQueries).containsKey("orders");
        assertThat(childQueries.get("orders").limit()).isEqualTo(20);
    }

    @Test
    void testGetCompositeRecord_Success() {
        CompositeRecordResponse record = new CompositeRecordResponse(
                42L, "tenant-test", 10L, true, 2L,
                Map.of("name", "Global Inc"), Collections.emptyMap(),
                "dataloader-fallback", LocalDateTime.now(), LocalDateTime.now()
        );

        when(compositeRecordService.getCompositeRecordByIdWithOptions(eq(100L), eq(42L), anyMap()))
                .thenReturn(record);

        ResponseEntity<ResponseWrapper<ContextHeader, CompositeRecordResponse>> response =
                controller.getCompositeRecord(100L, 42L, Collections.emptyMap());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getFirst("X-Composite-Engine")).isEqualTo("dataloader-fallback");
        assertThat(response.getBody().getBody().id()).isEqualTo(42L);
        assertThat(response.getBody().getBody().attributes()).containsEntry("name", "Global Inc");
    }
}
