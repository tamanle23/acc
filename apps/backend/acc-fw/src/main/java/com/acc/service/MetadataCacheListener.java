package com.acc.service;

import com.hazelcast.core.HazelcastInstance;
import com.hazelcast.map.IMap;
import com.acc.boot.config.HazelcastConfiguration;
import com.acc.domain.metadata.AttributeDefinitionUpdatedEvent;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Set;

@Slf4j
@Component
@RequiredArgsConstructor
public class MetadataCacheListener {

    private final HazelcastInstance hazelcastInstance;
    private final SchemaValidationService schemaValidationService;

    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void handleAttributeDefinitionUpdate(AttributeDefinitionUpdatedEvent event) {
        Long entityTypeId = event.getEntityTypeId();
        String tenantId = event.getTenantId();
        log.info("Invalidating composite schema cache for entity type: {} (tenant: {})", entityTypeId, tenantId);

        // 1. Evict in-memory L1 cache
        schemaValidationService.invalidateL1Cache(entityTypeId, tenantId);

        // 2. Evict distributed L2 Hazelcast cache keys
        try {
            if (hazelcastInstance != null) {
                IMap<String, String> map = hazelcastInstance.getMap(HazelcastConfiguration.METADATA_SCHEMAS_MAP);
                if (map != null) {
                    // Evict versioned keys matching tenant or entityTypeId
                    String targetPart = ":" + entityTypeId + ":";
                    Set<String> keys = map.keySet();
                    if (keys != null) {
                        for (String key : keys) {
                            if (key != null && key.contains(targetPart)) {
                                if (tenantId == null || tenantId.isBlank() || key.startsWith("schema:" + tenantId + ":")) {
                                    map.remove(key);
                                }
                            }
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to evict Hazelcast cache for entityTypeId {}: {}", entityTypeId, e.getMessage());
        }
    }
}
