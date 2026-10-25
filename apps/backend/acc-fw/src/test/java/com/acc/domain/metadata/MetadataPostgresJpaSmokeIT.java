package com.acc.domain.metadata;

import com.acc.repository.jpa.AttributeDefinitionRepository;
import com.acc.repository.jpa.EntityRecordRepository;
import com.acc.repository.jpa.EntityTypeRepository;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

@Tag("integration")
@Disabled("Smoke integration test against PostgreSQL container (Phase 0 C7)")
@SpringBootTest(classes = TestJpaConfig.class, properties = {
        "spring.datasource.url=jdbc:postgresql://localhost:54329/acc_test",
        "spring.datasource.username=postgres",
        "spring.datasource.password=postgres",
        "spring.datasource.driver-class-name=org.postgresql.Driver",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.show-sql=true",
        "spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect",
        "spring.cloud.compatibility-verifier.enabled=false",
        "spring.cloud.consul.enabled=false",
        "spring.cloud.discovery.enabled=false",
        "spring.cloud.config.enabled=false",
        "spring.graphql.schema.inspection.enabled=false"
})
class MetadataPostgresJpaSmokeIT {

    @Autowired
    private EntityTypeRepository entityTypeRepository;

    @Autowired
    private AttributeDefinitionRepository attributeDefinitionRepository;

    @Autowired
    private EntityRecordRepository entityRecordRepository;

    @Test
    void testPostgresJsonbPersistence() {
        // 1. Persist EntityType
        EntityType entityType = new EntityType();
        entityType.setName("Customer");
        entityType.setSystemName("customer");
        entityType.setDescription("Customer entity type");
        EntityType savedType = entityTypeRepository.save(entityType);
        assertNotNull(savedType.getId());

        // 2. Persist AttributeDefinition with options map (testing jsonb conversion)
        AttributeDefinition attr = new AttributeDefinition();
        attr.setEntityType(savedType);
        attr.setName("Status");
        attr.setSystemName("status");
        attr.setDataType("string");
        attr.setUiComponent("select");
        attr.setIsRequired(true);
        attr.setIsArchived(false);
        attr.setOptions(Map.of("choices", List.of("ACTIVE", "INACTIVE", "PENDING"), "default", "ACTIVE"));
        AttributeDefinition savedAttr = attributeDefinitionRepository.save(attr);
        assertNotNull(savedAttr.getId());

        // 3. Persist EntityRecord with attributes map (testing jsonb conversion)
        EntityRecord record = new EntityRecord();
        record.setEntityType(savedType);
        record.setTenantId("tenant-alpha");
        record.setAttributes(Map.of(
                "status", "ACTIVE",
                "score", 95,
                "verified", true,
                "tags", List.of("vip", "early-adopter")
        ));
        EntityRecord savedRecord = entityRecordRepository.save(record);
        assertNotNull(savedRecord.getId());

        // 4. Retrieve and verify deserialized contents from PostgreSQL
        Optional<AttributeDefinition> retrievedAttr = attributeDefinitionRepository.findById(savedAttr.getId());
        assertTrue(retrievedAttr.isPresent());
        assertEquals("status", retrievedAttr.get().getSystemName());
        assertNotNull(retrievedAttr.get().getOptions());
        assertEquals(List.of("ACTIVE", "INACTIVE", "PENDING"), retrievedAttr.get().getOptions().get("choices"));

        Optional<EntityRecord> retrievedRecord = entityRecordRepository.findById(savedRecord.getId());
        assertTrue(retrievedRecord.isPresent());
        assertEquals("tenant-alpha", retrievedRecord.get().getTenantId());
        assertNotNull(retrievedRecord.get().getAttributes());
        assertEquals("ACTIVE", retrievedRecord.get().getAttributes().get("status"));
        assertEquals(true, retrievedRecord.get().getAttributes().get("verified"));
    }
}
