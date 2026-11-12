package com.acc.service;

import com.hazelcast.core.HazelcastInstance;
import com.hazelcast.map.IMap;
import com.acc.boot.config.HazelcastConfiguration;
import com.acc.domain.metadata.AttributeDefinitionUpdatedEvent;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Set;

import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MetadataCacheListenerTest {

    @Mock
    private HazelcastInstance hazelcastInstance;

    @Mock
    private IMap<String, String> schemaMap;

    @Mock
    private SchemaValidationService schemaValidationService;

    @InjectMocks
    private MetadataCacheListener metadataCacheListener;

    @Test
    void testHandleAttributeDefinitionUpdate_ClearsCache() {
        Long entityTypeId = 1L;
        AttributeDefinitionUpdatedEvent event = new AttributeDefinitionUpdatedEvent(this, entityTypeId);

        doReturn(schemaMap).when(hazelcastInstance).getMap(HazelcastConfiguration.METADATA_SCHEMAS_MAP);
        when(schemaMap.keySet()).thenReturn(Set.of("schema:1:v1", "schema:1:v2", "schema:2:v1"));

        metadataCacheListener.handleAttributeDefinitionUpdate(event);

        verify(schemaValidationService).invalidateL1Cache(1L, null);
        verify(schemaMap).remove("schema:1:v1");
        verify(schemaMap).remove("schema:1:v2");
    }
}
