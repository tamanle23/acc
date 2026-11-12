package com.acc.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.acc.domain.metadata.*;
import com.acc.presentation.dto.metadata.CreateRecordRequest;
import com.acc.presentation.dto.metadata.UpdateRecordRequest;
import com.acc.repository.jpa.AttributeDefinitionRepository;
import com.acc.repository.jpa.EntityRecordRepository;
import com.acc.repository.jpa.EntityTypeRepository;
import com.acc.service.exception.MetadataConflictException;
import com.acc.service.exception.SchemaValidationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

public class CompositeEntityTypeVerificationTest {

    private ObjectMapper objectMapper;
    private CompositeSpecCompiler compiler;
    private DynamicIndexProvisioner indexProvisioner;
    private EntityTypeRepository entityTypeRepository;
    private AttributeDefinitionRepository attributeDefinitionRepository;
    private EntityRecordRepository entityRecordRepository;
    private MetadataService metadataService;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        compiler = new CompositeSpecCompiler(objectMapper);
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        indexProvisioner = new DynamicIndexProvisioner(jdbcTemplate);

        entityTypeRepository = mock(EntityTypeRepository.class);
        attributeDefinitionRepository = mock(AttributeDefinitionRepository.class);
        entityRecordRepository = mock(EntityRecordRepository.class);
        ApplicationEventPublisher eventPublisher = mock(ApplicationEventPublisher.class);

        metadataService = new MetadataService(
                entityTypeRepository,
                attributeDefinitionRepository,
                entityRecordRepository,
                null,
                null,
                null,
                eventPublisher,
                null,
                objectMapper,
                compiler,
                indexProvisioner
        );
    }

    @Test
    @DisplayName("Should compile valid CompositeSpec into draft-07 JSON Schema with nested arrays and objects")
    void testCompileCompositeSpecToJsonSchema() {
        CompositeField rootField1 = new CompositeField("customer_name", "name", "string", null, true);
        CompositeField rootField2 = new CompositeField("email_address", "email", "string", null, false);

        CompositeField childField1 = new CompositeField("total_amount", "amount", "number", 0.0, true);
        CompositeField childField2 = new CompositeField("order_status", "status", "string", "PENDING", false);

        CompositeNode childNode = new CompositeNode(
                20L,
                "order",
                "orders",
                CompositeJoinPattern.PATTERN_B_FOREIGN_KEY,
                "customer_id",
                null,
                "ONE_TO_MANY",
                List.of(childField1, childField2),
                List.of()
        );

        CompositeSpec spec = new CompositeSpec(
                10L,
                "customer",
                "customer360",
                List.of(rootField1, rootField2),
                List.of(childNode)
        );

        ObjectNode schema = compiler.compileNode(spec);
        assertThat(schema).isNotNull();
        assertThat(schema.get("$schema").asText()).isEqualTo("http://json-schema.org/draft-07/schema#");
        assertThat(schema.get("type").asText()).isEqualTo("object");
        assertThat(schema.get("additionalProperties").asBoolean()).isFalse();

        JsonNode properties = schema.get("properties");
        assertThat(properties.has("id")).isTrue();
        assertThat(properties.has("name")).isTrue();
        assertThat(properties.has("email")).isTrue();
        assertThat(properties.has("orders")).isTrue();

        JsonNode ordersNode = properties.get("orders");
        assertThat(ordersNode.get("type").asText()).isEqualTo("array");
        JsonNode items = ordersNode.get("items");
        assertThat(items.get("type").asText()).isEqualTo("object");
        assertThat(items.get("properties").has("amount")).isTrue();
        assertThat(items.get("properties").has("status")).isTrue();

        // Pushdown SQL preview check
        String pushdownSql = compiler.generatePushdownSql(spec);
        assertThat(pushdownSql).contains("Pushdown SQL Query Projection for Composite Entity: customer360");
        assertThat(pushdownSql).contains("UNIPOST_ENTITIES t_root");
        assertThat(pushdownSql).contains("LEFT JOIN LATERAL");
        assertThat(pushdownSql).contains("attributes->>'customer_id'");
    }

    @Test
    @DisplayName("Should reject CompositeSpec exceeding hard depth ceiling of 4 levels")
    void testExceedMaxDepthCeilingThrowsException() {
        // Build 5 levels deep: L1 (root) -> L2 -> L3 -> L4 -> L5
        CompositeNode level5 = new CompositeNode(50L, "tag", "tags", CompositeJoinPattern.PATTERN_B_FOREIGN_KEY, "item_id", null, "ONE_TO_MANY", List.of(), List.of());
        CompositeNode level4 = new CompositeNode(40L, "item", "items", CompositeJoinPattern.PATTERN_B_FOREIGN_KEY, "order_id", null, "ONE_TO_MANY", List.of(), List.of(level5));
        CompositeNode level3 = new CompositeNode(30L, "shipment", "shipments", CompositeJoinPattern.PATTERN_B_FOREIGN_KEY, "order_id", null, "ONE_TO_ONE", List.of(), List.of(level4));
        CompositeNode level2 = new CompositeNode(20L, "order", "orders", CompositeJoinPattern.PATTERN_B_FOREIGN_KEY, "customer_id", null, "ONE_TO_MANY", List.of(), List.of(level3));

        CompositeSpec deepSpec = new CompositeSpec(
                10L,
                "customer",
                "deep_customer",
                List.of(),
                List.of(level2)
        );

        assertThatThrownBy(() -> compiler.compileNode(deepSpec))
                .isInstanceOf(SchemaValidationException.class)
                .hasMessageContaining("exceeds maximum hierarchy depth ceiling of 4 levels");
    }

    @Test
    @DisplayName("Should detect recursive cycle in composite tree and throw SchemaValidationException")
    void testCycleDetectionThrowsException() {
        // Customer (10) -> Order (20) -> Customer (10) cycle
        CompositeNode cycleNode = new CompositeNode(10L, "customer", "cycle_customer", CompositeJoinPattern.PATTERN_B_FOREIGN_KEY, "fk_id", null, "ONE_TO_ONE", List.of(), List.of());
        CompositeNode orderNode = new CompositeNode(20L, "order", "orders", CompositeJoinPattern.PATTERN_B_FOREIGN_KEY, "customer_id", null, "ONE_TO_MANY", List.of(), List.of(cycleNode));

        CompositeSpec cyclicSpec = new CompositeSpec(
                10L,
                "customer",
                "customer_cycle",
                List.of(),
                List.of(orderNode)
        );

        assertThatThrownBy(() -> compiler.compileNode(cyclicSpec))
                .isInstanceOf(SchemaValidationException.class)
                .hasMessageContaining("Cycle detected in composite tree path");
    }

    @Test
    @DisplayName("Should generate PostgreSQL partial B-Tree functional index DDLs")
    void testDynamicIndexProvisionerStatements() {
        CompositeField rootField = new CompositeField("account_number", "acc_num", "string", null, true);
        CompositeNode childNode = new CompositeNode(
                20L,
                "order",
                "orders",
                CompositeJoinPattern.PATTERN_B_FOREIGN_KEY,
                "customer_ref",
                null,
                "ONE_TO_MANY",
                List.of(),
                List.of()
        );

        CompositeSpec spec = new CompositeSpec(
                10L,
                "customer",
                "customer_indexed",
                List.of(rootField),
                List.of(childNode)
        );

        List<String> ddlStatements = indexProvisioner.generateIndexStatements(spec);
        assertThat(ddlStatements).hasSize(2);
        assertThat(ddlStatements.get(0)).contains("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comp_root_10_account_number ON UNIPOST_ENTITIES ((attributes->>'account_number'))");
        assertThat(ddlStatements.get(1)).contains("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comp_b_fk_20_customer_ref ON UNIPOST_ENTITIES ((attributes->>'customer_ref'))");
    }

    @Test
    @DisplayName("Should reject record mutations with UnsupportedOperationException for composite entity types")
    void testCompositeEntityIsStrictlyReadOnly() {
        EntityType compositeType = new EntityType();
        compositeType.setId(99L);
        compositeType.setName("Customer360View");
        compositeType.setSystemName("customer_360_view");
        compositeType.setIsComposite(true);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(99L)).thenReturn(Optional.of(compositeType));

        // Create rejection
        assertThatThrownBy(() -> metadataService.createEntityRecord(99L, new CreateRecordRequest(Map.of("name", "Alice"), "tenant-1")))
                .isInstanceOf(UnsupportedOperationException.class)
                .hasMessageContaining("Composite entity types are strictly virtual and read-only");

        // Update rejection
        assertThatThrownBy(() -> metadataService.updateEntityRecord(99L, 1L, new UpdateRecordRequest(Map.of("name", "Alice"), 1L)))
                .isInstanceOf(UnsupportedOperationException.class)
                .hasMessageContaining("Composite entity types are strictly virtual and read-only");

        // Delete rejection
        assertThatThrownBy(() -> metadataService.deleteEntityRecord(99L, 1L))
                .isInstanceOf(UnsupportedOperationException.class)
                .hasMessageContaining("Composite entity types are strictly virtual and read-only");
    }

    @Test
    @DisplayName("Strict Dependency Guard: Deleting or archiving base attribute referenced in composite spec must throw 409 Conflict")
    void testStrictDependencyGuardOnAttributeDeletion() {
        // Base entity type and attribute
        EntityType customerType = new EntityType();
        customerType.setId(10L);
        customerType.setName("Customer");
        customerType.setIsComposite(false);

        AttributeDefinition emailAttr = new AttributeDefinition();
        emailAttr.setId(101L);
        emailAttr.setEntityType(customerType);
        emailAttr.setSystemName("email_address");

        // Composite entity referencing email_address
        EntityType compositeType = new EntityType();
        compositeType.setId(99L);
        compositeType.setName("Customer360");
        compositeType.setIsComposite(true);

        CompositeSpec spec = new CompositeSpec(
                10L,
                "customer",
                "customer_360",
                List.of(new CompositeField("email_address", "email", "string", null, true)),
                List.of()
        );
        compositeType.setCompositeSpec(spec);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(customerType));
        when(attributeDefinitionRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(10L, 101L)).thenReturn(Optional.of(emailAttr));
        when(entityTypeRepository.findAllByDeletedDateIsNull()).thenReturn(List.of(customerType, compositeType));

        // Attempting to delete attribute must throw MetadataConflictException
        assertThatThrownBy(() -> metadataService.deleteAttributeDefinition(10L, 101L, true))
                .isInstanceOf(MetadataConflictException.class)
                .hasMessageContaining("Cannot delete or archive base attribute 'email_address' because it is actively referenced in composite entity specification");

        // Attempting to archive attribute must throw MetadataConflictException
        assertThatThrownBy(() -> metadataService.archiveAttributeDefinition(10L, 101L))
                .isInstanceOf(MetadataConflictException.class)
                .hasMessageContaining("Cannot delete or archive base attribute 'email_address' because it is actively referenced in composite entity specification");
    }
}
