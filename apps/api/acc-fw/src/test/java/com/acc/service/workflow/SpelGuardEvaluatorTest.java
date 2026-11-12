package com.acc.service.workflow;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class SpelGuardEvaluatorTest {

    private SpelGuardEvaluator evaluator;

    @BeforeEach
    void setUp() {
        evaluator = new SpelGuardEvaluator();
    }

    @Test
    void testEvaluate_NullOrBlankExpression_ReturnsTrue() {
        assertTrue(evaluator.evaluate(null, Map.of(), null, "tenant-test", "DRAFT", "PUBLISHED"));
        assertTrue(evaluator.evaluate("", Map.of(), null, "tenant-test", "DRAFT", "PUBLISHED"));
        assertTrue(evaluator.evaluate("   ", Map.of(), null, "tenant-test", "DRAFT", "PUBLISHED"));
    }

    @Test
    void testEvaluate_ValidExpressions() {
        Map<String, Object> attrs = Map.of("score", 85, "tier", "GOLD");

        // Evaluates to true
        assertTrue(evaluator.evaluate("#attributes['score'] > 80", attrs, null, "tenant-test", "DRAFT", "APPROVED"));
        assertTrue(evaluator.evaluate("#tenantId == 'tenant-test' and #newState == 'APPROVED'", attrs, null, "tenant-test", "DRAFT", "APPROVED"));

        // Evaluates to false
        assertFalse(evaluator.evaluate("#attributes['score'] < 50", attrs, null, "tenant-test", "DRAFT", "APPROVED"));
    }

    @Test
    void testEvaluate_InvalidExpression_HandlesGracefully() {
        // Syntax error in SpEL
        assertFalse(evaluator.evaluate("this is not valid spel syntax !!!", Map.of(), null, "tenant-test", "DRAFT", "APPROVED"));
    }
}
