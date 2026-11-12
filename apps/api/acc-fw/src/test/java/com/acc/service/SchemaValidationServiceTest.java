package com.acc.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.acc.domain.metadata.AttributeDefinition;
import com.acc.domain.metadata.EntityType;
import com.acc.repository.jpa.AttributeDefinitionRepository;
import com.acc.repository.jpa.EntityTypeRepository;
import com.acc.service.exception.SchemaValidationException;
import com.hazelcast.core.HazelcastInstance;
import com.hazelcast.map.IMap;
import com.acc.boot.config.HazelcastConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SchemaValidationServiceTest {

    @Mock
    private HazelcastInstance hazelcastInstance;

    @Mock
    private IMap<String, String> schemaMap;

    @Mock
    private AttributeDefinitionRepository attributeDefinitionRepository;

    @Mock
    private EntityTypeRepository entityTypeRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @Spy
    private SchemaCompiler schemaCompiler = new SchemaCompiler(new ObjectMapper());

    @InjectMocks
    private SchemaValidationService schemaValidationService;

    private EntityType entityType;

    @BeforeEach
    void setUp() {
        com.acc.fw.tenancy.TenantContextHolder.setTenantId("tenant-acme");
        entityType = new EntityType();
        entityType.setId(1L);
        entityType.setSchemaVersion(1L);
        entityType.setTenantId("tenant-acme");

        lenient().doReturn(schemaMap).when(hazelcastInstance).getMap(HazelcastConfiguration.METADATA_SCHEMAS_MAP);
        lenient().when(entityTypeRepository.findByIdAndDeletedDateIsNull(1L)).thenReturn(Optional.of(entityType));
    }

    @org.junit.jupiter.api.AfterEach
    void tearDown() {
        com.acc.fw.tenancy.TenantContextHolder.clear();
    }

    @Test
    void testValidatePayload_CacheHit_Success() {
        Long entityTypeId = 1L;
        Map<String, Object> payload = new HashMap<>();
        payload.put("name", "Test Entity");

        String cachedSchema = "{\"$schema\": \"http://json-schema.org/draft-07/schema#\", \"type\": \"object\", \"properties\": {\"name\": {\"type\": \"string\"}}, \"required\": [\"name\"]}";

        when(schemaMap.get("schema:tenant-acme:1:v1_s1")).thenReturn(cachedSchema);

        assertDoesNotThrow(() -> schemaValidationService.validatePayload(entityTypeId, payload));
    }

    @Test
    void testValidatePayload_CacheMiss_CompilesAndSaves() {
        Long entityTypeId = 1L;
        Map<String, Object> payload = new HashMap<>();

        AttributeDefinition attr = new AttributeDefinition();
        attr.setSystemName("age");
        attr.setUiComponent("number");
        attr.setDataType("integer");
        attr.setIsRequired(false);

        when(schemaMap.get("schema:tenant-acme:1:v1_s1")).thenReturn(null);
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNullOrderByDisplayOrderAsc(entityTypeId)).thenReturn(Collections.singletonList(attr));

        assertDoesNotThrow(() -> schemaValidationService.validatePayload(entityTypeId, payload));

        verify(schemaMap).putIfAbsent(eq("schema:tenant-acme:1:v1_s1"), anyString(), eq(1L), eq(TimeUnit.HOURS));
    }

    @Test
    void testValidatePayload_ValidationFails_StructuredErrors() {
        Long entityTypeId = 1L;
        Map<String, Object> payload = new HashMap<>();

        String cachedSchema = "{\"$schema\": \"http://json-schema.org/draft-07/schema#\", \"type\": \"object\", \"properties\": {\"name\": {\"type\": \"string\"}}, \"required\": [\"name\"]}";
        when(schemaMap.get("schema:tenant-acme:1:v1_s1")).thenReturn(cachedSchema);

        SchemaValidationException ex = assertThrows(SchemaValidationException.class,
                () -> schemaValidationService.validatePayload(entityTypeId, payload));

        assertFalse(ex.getErrors().isEmpty());
        assertTrue(ex.getErrors().get(0).getMessage().contains("name"));
    }

    @Test
    void testValidatePayload_SupportsBooleanSwitch() {
        Long entityTypeId = 1L;
        AttributeDefinition attr = new AttributeDefinition();
        attr.setSystemName("isActive");
        attr.setUiComponent("switch");
        attr.setIsRequired(true);

        when(schemaMap.get("schema:tenant-acme:1:v1_s1")).thenReturn(null);
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNullOrderByDisplayOrderAsc(entityTypeId)).thenReturn(Collections.singletonList(attr));

        Map<String, Object> payload = Map.of("isActive", true);
        assertDoesNotThrow(() -> schemaValidationService.validatePayload(entityTypeId, payload));
    }

    @Test
    void testValidatePayload_RejectsAdditionalProperties() {
        Long entityTypeId = 1L;
        AttributeDefinition attr = new AttributeDefinition();
        attr.setSystemName("name");
        attr.setUiComponent("text");
        attr.setDataType("string");
        attr.setIsRequired(false);

        when(schemaMap.get("schema:tenant-acme:1:v1_s1")).thenReturn(null);
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNullOrderByDisplayOrderAsc(entityTypeId)).thenReturn(Collections.singletonList(attr));

        Map<String, Object> payload = Map.of("name", "Valid", "unknownField", "Should Fail");
        assertThrows(SchemaValidationException.class, () -> schemaValidationService.validatePayload(entityTypeId, payload));
    }

    @Test
    void testCompileSchemaNode_Success() {
        Long entityTypeId = 1L;
        AttributeDefinition attr = new AttributeDefinition();
        attr.setSystemName("code");
        attr.setUiComponent("text");
        attr.setDataType("string");

        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNullOrderByDisplayOrderAsc(entityTypeId)).thenReturn(List.of(attr));

        JsonNode schemaNode = schemaValidationService.compileSchemaNode(entityTypeId);
        assertNotNull(schemaNode);
        assertEquals("object", schemaNode.get("type").asText());
        assertNotNull(schemaNode.get("properties").get("code"));
    }

    @Test
    void testConcurrentGetOrCompileJsonSchema_StampedeMitigated() throws InterruptedException {
        Long entityTypeId = 1L;
        AttributeDefinition attr = new AttributeDefinition();
        attr.setSystemName("tier");
        attr.setUiComponent("text");
        attr.setDataType("string");

        when(schemaMap.get("schema:tenant-acme:1:v1_s1")).thenReturn(null);
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNullOrderByDisplayOrderAsc(entityTypeId))
                .thenReturn(List.of(attr));

        int threadCount = 20;
        java.util.concurrent.ExecutorService executor = java.util.concurrent.Executors.newFixedThreadPool(threadCount);
        java.util.concurrent.CountDownLatch readyLatch = new java.util.concurrent.CountDownLatch(threadCount);
        java.util.concurrent.CountDownLatch startLatch = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.CountDownLatch doneLatch = new java.util.concurrent.CountDownLatch(threadCount);
        java.util.List<com.networknt.schema.JsonSchema> results = Collections.synchronizedList(new java.util.ArrayList<>());

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                readyLatch.countDown();
                try {
                    startLatch.await();
                    com.acc.fw.tenancy.TenantContextHolder.setTenantId("tenant-acme");
                    results.add(schemaValidationService.getOrCompileJsonSchema(entityTypeId, 1L));
                } catch (Exception e) {
                    fail("Concurrent getOrCompileJsonSchema failed: " + e.getMessage());
                } finally {
                    com.acc.fw.tenancy.TenantContextHolder.clear();
                    doneLatch.countDown();
                }
            });
        }

        readyLatch.await(5, TimeUnit.SECONDS);
        startLatch.countDown(); // Fire all 20 threads simultaneously
        doneLatch.await(5, TimeUnit.SECONDS);
        executor.shutdown();

        assertEquals(threadCount, results.size(), "All threads should have received a compiled schema");
        com.networknt.schema.JsonSchema first = results.get(0);
        for (com.networknt.schema.JsonSchema schema : results) {
            assertSame(first, schema, "All threads must share the exact same atomic L1 cached JsonSchema instance");
        }

        // DB attribute repository findByEntityTypeId must only be invoked exactly ONCE
        verify(attributeDefinitionRepository, times(1)).findByEntityTypeIdAndDeletedDateIsNullOrderByDisplayOrderAsc(entityTypeId);
        verify(schemaMap, times(1)).putIfAbsent(eq("schema:tenant-acme:1:v1_s1"), anyString(), eq(1L), eq(TimeUnit.HOURS));
    }

    @Test
    void testInvalidateL1Cache() {
        assertDoesNotThrow(() -> schemaValidationService.invalidateL1Cache(1L));
        assertDoesNotThrow(() -> schemaValidationService.invalidateL1Cache(1L, "tenant-acme"));
    }

    @Test
    void testCompileSchemaAndNode() {
        AttributeDefinition attr = new AttributeDefinition();
        attr.setSystemName("title");
        attr.setDataType("string");
        attr.setUiComponent("text");
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNullOrderByDisplayOrderAsc(1L))
                .thenReturn(List.of(attr));

        String compiled = schemaValidationService.compileSchema(1L);
        assertNotNull(compiled);
        assertTrue(compiled.contains("title"));

        JsonNode node = schemaValidationService.compileSchemaNode(1L);
        assertNotNull(node);
        assertTrue(node.has("properties"));
    }

    @Test
    void testValidatePayloadDryRun_ValidAndInvalid() {
        AttributeDefinition attr = new AttributeDefinition();
        attr.setSystemName("age");
        attr.setDataType("integer");
        attr.setUiComponent("number");
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNullOrderByDisplayOrderAsc(1L))
                .thenReturn(List.of(attr));

        // Valid payload
        List<com.acc.core.io.Error> validErrors = schemaValidationService.validatePayloadDryRun(1L, Map.of("age", 25));
        assertTrue(validErrors.isEmpty());

        // Invalid payload (additional property not in schema)
        List<com.acc.core.io.Error> invalidErrors = schemaValidationService.validatePayloadDryRun(1L, Map.of("unknownProp", "bad"));
        assertFalse(invalidErrors.isEmpty());
    }

    @Test
    void testHazelcastFailure_GracefulFallbackToCompilation() {
        when(schemaMap.get(anyString())).thenThrow(new RuntimeException("Hazelcast cluster disconnected"));
        AttributeDefinition attr = new AttributeDefinition();
        attr.setSystemName("notes");
        attr.setDataType("string");
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNullOrderByDisplayOrderAsc(1L))
                .thenReturn(List.of(attr));

        com.networknt.schema.JsonSchema schema = schemaValidationService.getOrCompileJsonSchema(1L, 1L);
        assertNotNull(schema);
    }
}

