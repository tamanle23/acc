package com.unipost.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.networknt.schema.JsonSchema;
import com.networknt.schema.JsonSchemaFactory;
import com.networknt.schema.SpecVersion;
import com.networknt.schema.ValidationMessage;
import com.hazelcast.core.HazelcastInstance;
import com.hazelcast.map.IMap;
import com.unipost.boot.config.HazelcastConfiguration;
import com.unipost.core.io.Error;
import com.unipost.domain.metadata.AttributeDefinition;
import com.unipost.domain.metadata.EntityType;
import com.unipost.fw.tenancy.TenantContextHolder;
import com.unipost.repository.jpa.AttributeDefinitionRepository;
import com.unipost.repository.jpa.EntityTypeRepository;
import com.unipost.service.exception.MetadataNotFoundException;
import com.unipost.service.exception.SchemaValidationException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SchemaValidationService {

    private final HazelcastInstance hazelcastInstance;
    private final ObjectMapper objectMapper;
    private final AttributeDefinitionRepository attributeDefinitionRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final SchemaCompiler schemaCompiler;
    private final CompositeSpecCompiler compositeSpecCompiler;
    private final JsonSchemaFactory schemaFactory = JsonSchemaFactory.getInstance(SpecVersion.VersionFlag.V7);

    public SchemaValidationService(
            HazelcastInstance hazelcastInstance,
            ObjectMapper objectMapper,
            AttributeDefinitionRepository attributeDefinitionRepository,
            EntityTypeRepository entityTypeRepository,
            SchemaCompiler schemaCompiler
    ) {
        this(hazelcastInstance, objectMapper, attributeDefinitionRepository, entityTypeRepository, schemaCompiler, new CompositeSpecCompiler(objectMapper));
    }

    // L1 in-memory cache holding parsed JsonSchema objects for maximum throughput
    private final Map<String, JsonSchema> l1ParsedSchemaCache = new ConcurrentHashMap<>();

    // Dedicated bounded thread pool for schema validation with strict timeout guards
    private final java.util.concurrent.ExecutorService validationExecutor = java.util.concurrent.Executors.newCachedThreadPool();

    private IMap<String, String> getHazelcastSchemaMap() {
        if (hazelcastInstance != null) {
            return hazelcastInstance.getMap(HazelcastConfiguration.METADATA_SCHEMAS_MAP);
        }
        return null;
    }

    /**
     * Build composite cache key: schema:{tenant_id}:{entity_type_id}:v{tenantVer}_s{systemVer}
     */
    public String buildCacheKey(String tenantId, Long entityTypeId, Long schemaVersion) {
        String tid = (tenantId != null && !tenantId.isBlank()) ? tenantId : com.unipost.fw.tenancy.TenantContextHolder.getTenantId();
        if (tid == null || tid.isBlank()) {
            throw new SecurityException("Tenant context required for cache key compilation.");
        }
        long version = schemaVersion != null ? schemaVersion : 1L;
        // In dual-layer versioning, schema key encodes tenant identity and versions:
        // schema:{tenant_id}:{entity_type_id}:v{tenantVer}_s{systemVer}
        return "schema:" + tid + ":" + entityTypeId + ":v" + version + "_s1";
    }

    public void invalidateL1Cache(Long entityTypeId) {
        invalidateL1Cache(entityTypeId, null);
    }

    public void invalidateL1Cache(Long entityTypeId, String tenantId) {
        if (entityTypeId == null) {
            l1ParsedSchemaCache.clear();
            return;
        }
        if (tenantId != null && !tenantId.isBlank()) {
            String prefix = "schema:" + tenantId + ":" + entityTypeId + ":";
            l1ParsedSchemaCache.keySet().removeIf(k -> k.startsWith(prefix));
        } else {
            // Remove across any tenant if tenantId is not specified
            String target = ":" + entityTypeId + ":";
            l1ParsedSchemaCache.keySet().removeIf(k -> k.contains(target));
        }
    }

    public JsonSchema getOrCompileJsonSchema(Long entityTypeId, Long schemaVersion) {
        String tenantId = TenantContextHolder.getTenantId();
        return getOrCompileJsonSchema(tenantId, entityTypeId, schemaVersion);
    }

    public JsonSchema getOrCompileJsonSchema(String tenantId, Long entityTypeId, Long schemaVersion) {
        String cacheKey = buildCacheKey(tenantId, entityTypeId, schemaVersion);

        // Fast path: L1 parsed schema cache hit
        JsonSchema l1Schema = l1ParsedSchemaCache.get(cacheKey);
        if (l1Schema != null) {
            return l1Schema;
        }

        // Lock-free atomic L1 computeIfAbsent prevents cache stampede / thundering herd
        return l1ParsedSchemaCache.computeIfAbsent(cacheKey, key -> {
            // 1. Check L2 Hazelcast distributed cache
            String schemaJson = null;
            try {
                IMap<String, String> schemaMap = getHazelcastSchemaMap();
                if (schemaMap != null) {
                    schemaJson = schemaMap.get(key);
                }
            } catch (Exception e) {
                log.warn("Hazelcast L2 cache read failed for {}: {}", key, e.getMessage());
            }

            // 2. Distributed double-check / compile on cache miss
            if (schemaJson == null) {
                log.debug("L1/L2 schema cache miss for {}. Compiling from DB rules...", key);
                schemaJson = compileEffectiveSchema(tenantId, entityTypeId);
                try {
                    IMap<String, String> schemaMap = getHazelcastSchemaMap();
                    if (schemaMap != null) {
                        schemaMap.putIfAbsent(key, schemaJson, 1, TimeUnit.HOURS);
                    }
                } catch (Exception e) {
                    log.warn("Hazelcast L2 cache write failed for {}: {}", key, e.getMessage());
                }
            }

            // 3. Parse and compile into immutable JsonSchema instance
            try {
                JsonNode schemaNode = objectMapper.readTree(schemaJson);
                return schemaFactory.getSchema(schemaNode);
            } catch (Exception e) {
                log.error("Failed to parse compiled schema JSON into JsonSchema for entityTypeId {}", entityTypeId, e);
                throw new IllegalStateException("Failed to parse JSON schema: " + e.getMessage(), e);
            }
        });
    }

    public List<Error> validatePayloadDryRun(Long entityTypeId, Map<String, Object> payload) {
        return validatePayloadDryRun(TenantContextHolder.getTenantId(), entityTypeId, payload);
    }

    public List<Error> validatePayloadDryRun(String tenantId, Long entityTypeId, Map<String, Object> payload) {
        EntityType entityType = entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId)
                .orElse(null);
        Long schemaVersion = entityType != null ? entityType.getSchemaVersion() : 1L;

        JsonSchema schema = getOrCompileJsonSchema(tenantId, entityTypeId, schemaVersion);

        try {
            JsonNode payloadNode = objectMapper.valueToTree(payload != null ? payload : Map.of());

            // Tier 2 ReDoS Defense: strictly cap computational validation budget to 50 milliseconds
            java.util.concurrent.Future<Set<ValidationMessage>> future = validationExecutor.submit(() -> schema.validate(payloadNode));

            Set<ValidationMessage> validationResult;
            try {
                validationResult = future.get(50, TimeUnit.MILLISECONDS);
            } catch (java.util.concurrent.TimeoutException te) {
                future.cancel(true);
                throw new com.unipost.service.exception.ValidationTimeoutException(
                        "Schema validation timed out (>50ms); evaluation aborted to mitigate catastrophic regex backtracking (ReDoS)");
            }

            if (validationResult == null || validationResult.isEmpty()) {
                return List.of();
            }

            List<Error> errorList = new ArrayList<>();
            for (ValidationMessage vm : validationResult) {
                String path = vm.getInstanceLocation() != null ? vm.getInstanceLocation().toString() : vm.getProperty();
                if (path != null && path.startsWith("$.")) {
                    path = path.substring(2);
                }
                errorList.add(Error.builder()
                        .code("VALIDATION_ERROR")
                        .message(vm.getMessage())
                        .detail(path)
                        .build());
            }
            return errorList;
        } catch (com.unipost.service.exception.ValidationTimeoutException vte) {
            throw vte;
        } catch (Exception e) {
            log.error("Error dry-run validating payload against schema for entityTypeId {}", entityTypeId, e);
            return List.of(Error.builder()
                    .code("VALIDATION_ERROR")
                    .message("Validation error: " + e.getMessage())
                    .build());
        }
    }

    public void validatePayload(Long entityTypeId, Map<String, Object> payload) {
        validatePayload(TenantContextHolder.getTenantId(), entityTypeId, payload);
    }

    public void validatePayload(String tenantId, Long entityTypeId, Map<String, Object> payload) {
        List<Error> errorList = validatePayloadDryRun(tenantId, entityTypeId, payload);
        if (!errorList.isEmpty()) {
            throw new SchemaValidationException(errorList);
        }
    }

    /**
     * Composites base System attributes (SYSTEM) with Tenant custom overlay attributes.
     */
    public List<AttributeDefinition> resolveEffectiveAttributes(String tenantId, Long entityTypeId) {
        List<AttributeDefinition> allVisible = attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNullOrderByDisplayOrderAsc(entityTypeId);
        if (allVisible == null || allVisible.isEmpty()) {
            return List.of();
        }

        // Composite map preserving order: System attributes first, tenant overlays overlaying or appending
        Map<String, AttributeDefinition> compositeMap = new LinkedHashMap<>();

        // First pass: include active SYSTEM attributes
        for (AttributeDefinition attr : allVisible) {
            if ("SYSTEM".equalsIgnoreCase(attr.getTenantId())) {
                compositeMap.put(attr.getSystemName(), attr);
            }
        }

        // Second pass: include or overlay tenant's own attributes
        String activeTenant = (tenantId != null && !tenantId.isBlank()) ? tenantId : com.unipost.fw.tenancy.TenantContextHolder.getTenantId();
        if (activeTenant != null && !activeTenant.isBlank()) {
            for (AttributeDefinition attr : allVisible) {
                if (activeTenant.equalsIgnoreCase(attr.getTenantId())) {
                    compositeMap.put(attr.getSystemName(), attr);
                }
            }
        }

        // If no SYSTEM or tenant filter matched (e.g. tests without tenant separation), return all visible
        if (compositeMap.isEmpty()) {
            return allVisible;
        }

        return new ArrayList<>(compositeMap.values());
    }

    public String compileEffectiveSchema(String tenantId, Long entityTypeId) {
        EntityType entityType = entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId)
                .orElseThrow(() -> new MetadataNotFoundException("EntityType not found with id: " + entityTypeId));

        if (Boolean.TRUE.equals(entityType.getIsComposite()) && entityType.getCompositeSpec() != null) {
            JsonNode node = compositeSpecCompiler.compileNode(entityType.getCompositeSpec());
            try {
                return objectMapper.writeValueAsString(node);
            } catch (Exception e) {
                throw new RuntimeException("Failed to serialize composite schema for entityTypeId: " + entityTypeId, e);
            }
        }

        List<AttributeDefinition> attributes = resolveEffectiveAttributes(tenantId, entityTypeId);
        return schemaCompiler.compile(entityTypeId, entityType.getSchemaVersion(), attributes);
    }

    public String compileSchema(Long entityTypeId) {
        String tenantId = TenantContextHolder.getTenantId();
        return compileEffectiveSchema(tenantId, entityTypeId);
    }

    public JsonNode compileSchemaNode(Long entityTypeId) {
        EntityType entityType = entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId)
                .orElseThrow(() -> new MetadataNotFoundException("EntityType not found with id: " + entityTypeId));

        if (Boolean.TRUE.equals(entityType.getIsComposite()) && entityType.getCompositeSpec() != null) {
            return compositeSpecCompiler.compileNode(entityType.getCompositeSpec());
        }

        String tenantId = TenantContextHolder.getTenantId();
        List<AttributeDefinition> attributes = resolveEffectiveAttributes(tenantId, entityTypeId);
        return schemaCompiler.compileNode(entityTypeId, entityType.getSchemaVersion(), attributes);
    }
}
