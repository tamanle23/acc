package com.acc.service.workflow;

import com.acc.domain.metadata.EntityRecordMutatedEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Collections;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class EntityWorkflowTriggerDispatcherSpELTest {

    private EntityWorkflowTriggerDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        dispatcher = new EntityWorkflowTriggerDispatcher(null);
    }

    @Test
    @DisplayName("Should evaluate action equality correctly")
    void shouldEvaluateActionEquality() {
        EntityRecordMutatedEvent event = new EntityRecordMutatedEvent(
            1L, 100L, "tenant_a", "CREATE", "user_1", 1L,
            Map.of("title", "Hello"), Collections.emptyMap(), Instant.now()
        );

        boolean matches = dispatcher.evaluatePredicate("#action == 'CREATE'", event);
        assertThat(matches).isTrue();

        boolean mismatch = dispatcher.evaluatePredicate("#action == 'UPDATE'", event);
        assertThat(mismatch).isFalse();
    }

    @Test
    @DisplayName("Should evaluate attribute delta condition when state changes")
    void shouldEvaluateAttributeDeltaCondition() {
        EntityRecordMutatedEvent event = new EntityRecordMutatedEvent(
            2L, 200L, "tenant_a", "UPDATE", "admin", 2L,
            Map.of("status", "APPROVED", "amount", 15000),
            Map.of("status", "PENDING", "amount", 15000),
            Instant.now()
        );

        String expr = "#new['status'] == 'APPROVED' && #old['status'] != 'APPROVED' && #new['amount'] > 10000";
        boolean matches = dispatcher.evaluatePredicate(expr, event);
        assertThat(matches).isTrue();

        String failingExpr = "#new['amount'] > 50000";
        boolean fails = dispatcher.evaluatePredicate(failingExpr, event);
        assertThat(fails).isFalse();
    }

    private static Map<String, Object> CollectionsEmptyMap() {
        return java.util.Collections.emptyMap();
    }
}
