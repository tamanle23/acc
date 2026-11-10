package com.acc.workflow.application;

import com.acc.workflow.adapters.storage.InMemoryPersistenceAdapter;
import com.acc.workflow.core.model.TaskDefinitionRecord;
import com.acc.workflow.core.model.WorkflowVersionStatus;
import com.acc.workflow.ports.PersistencePort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class TaskDefinitionRegistryTest {

    private PersistencePort persistencePort;
    private TaskDefinitionRegistry registry;

    @BeforeEach
    void setUp() {
        persistencePort = new InMemoryPersistenceAdapter();
        registry = new TaskDefinitionRegistry(persistencePort);
    }

    @Test
    @DisplayName("Should seed built-in task definitions")
    void testSeedBuiltIns() {
        registry.seedBuiltIns();

        List<TaskDefinitionRecord> activeDefs = registry.listLatest("system");
        assertThat(activeDefs).isNotEmpty();
        assertThat(activeDefs).anyMatch(d -> d.name().equals("validateOrder") && d.version() == 1 && d.status() == WorkflowVersionStatus.ACTIVE);
        assertThat(activeDefs).anyMatch(d -> d.name().equals("chargePayment") && d.version() == 1 && d.status() == WorkflowVersionStatus.ACTIVE);
        assertThat(activeDefs).anyMatch(d -> d.name().equals("publishCmsArticle") && d.version() == 1 && d.status() == WorkflowVersionStatus.ACTIVE);
    }

    @Test
    @DisplayName("Should create next version draft and successfully publish it")
    void testCreateDraftAndPublishLifecycle() {
        // Create initial draft
        TaskDefinitionRecord v1Draft = registry.createOrForkDraft(
            "tenant-lifecycle",
            "customValidateOrder",
            "Initial cart validation",
            3, 2, 2.0, 30,
            Map.of("type", "object", "properties", Map.of("orderId", Map.of("type", "string"))),
            Map.of("type", "object", "properties", Map.of("valid", Map.of("type", "boolean"))),
            "Initial v1 draft",
            "dev-1"
        );
        assertThat(v1Draft.version()).isEqualTo(1);
        assertThat(v1Draft.status()).isEqualTo(WorkflowVersionStatus.DRAFT);

        // Publish v1
        TaskDefinitionRecord v1Active = registry.publishVersion("tenant-lifecycle", "customValidateOrder", 1, "lead-eng@acc.com");
        assertThat(v1Active.status()).isEqualTo(WorkflowVersionStatus.ACTIVE);

        // Fork next version draft (v2)
        TaskDefinitionRecord v2Draft = registry.createOrForkDraft(
            "tenant-lifecycle",
            "customValidateOrder",
            "Enhanced cart validation with coupon checks",
            3, 2, 2.0, 30,
            Map.of("type", "object", "properties", Map.of("orderId", Map.of("type", "string"), "couponCode", Map.of("type", "string"))),
            Map.of("type", "object", "properties", Map.of("valid", Map.of("type", "boolean"), "discount", Map.of("type", "number"))),
            "Added coupon code support",
            "dev-2"
        );

        assertThat(v2Draft.version()).isEqualTo(2);
        assertThat(v2Draft.status()).isEqualTo(WorkflowVersionStatus.DRAFT);
        assertThat(v2Draft.changelogNote()).isEqualTo("Added coupon code support");

        // Latest ACTIVE is still v1 before v2 is published
        TaskDefinitionRecord currentActive = registry.resolve("tenant-lifecycle", "customValidateOrder", null).orElseThrow();
        assertThat(currentActive.version()).isEqualTo(1);

        // Publish draft v2
        TaskDefinitionRecord publishedV2 = registry.publishVersion("tenant-lifecycle", "customValidateOrder", 2, "sec-eng@acc.com");
        assertThat(publishedV2.version()).isEqualTo(2);
        assertThat(publishedV2.status()).isEqualTo(WorkflowVersionStatus.ACTIVE);
        assertThat(publishedV2.publishedBy()).isEqualTo("sec-eng@acc.com");

        // Now latest active is v2
        TaskDefinitionRecord newActive = registry.resolve("tenant-lifecycle", "customValidateOrder", null).orElseThrow();
        assertThat(newActive.version()).isEqualTo(2);

        // Previous v1 is deprecated
        TaskDefinitionRecord v1Deprecated = registry.resolve("tenant-lifecycle", "customValidateOrder", 1).orElseThrow();
        assertThat(v1Deprecated.status()).isEqualTo(WorkflowVersionStatus.DEPRECATED);
    }

    @Test
    @DisplayName("Should delete DRAFT version but reject deleting ACTIVE version")
    void testDeleteDraftOnly() {
        TaskDefinitionRecord draft = registry.createOrForkDraft(
            "tenant-delete",
            "tempTask",
            "Temporary task",
            3, 2, 2.0, 30,
            Map.of(), Map.of(),
            "Temporary draft",
            "dev-1"
        );

        boolean deleted = registry.deleteDraftVersion("tenant-delete", "tempTask", draft.version());
        assertThat(deleted).isTrue();
        assertThat(registry.resolve("tenant-delete", "tempTask", draft.version())).isEmpty();

        // Create and publish
        TaskDefinitionRecord activeRecord = registry.createOrForkDraft(
            "tenant-delete",
            "immutableTask",
            "Permanent task",
            3, 2, 2.0, 30,
            Map.of(), Map.of(),
            "v1 draft",
            "dev-1"
        );
        registry.publishVersion("tenant-delete", "immutableTask", activeRecord.version(), "admin");

        // Attempting to delete ACTIVE should throw IllegalStateException
        assertThatThrownBy(() -> registry.deleteDraftVersion("tenant-delete", "immutableTask", activeRecord.version()))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("Only DRAFT versions can be deleted");
    }
}
