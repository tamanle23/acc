package com.acc.service.workflow;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Primary;
import org.springframework.expression.Expression;
import org.springframework.expression.ExpressionParser;
import org.springframework.expression.spel.standard.SpelExpressionParser;
import org.springframework.expression.spel.support.StandardEvaluationContext;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Standard Spring Expression Language (SpEL) implementation of {@link GuardEvaluatorStrategy}.
 */
@Slf4j
@Primary
@Component
public class SpelGuardEvaluator implements GuardEvaluatorStrategy {

    private final ExpressionParser parser = new SpelExpressionParser();
    private final Map<String, Expression> expressionCache = new ConcurrentHashMap<>();

    @Override
    public boolean evaluate(String guardExpression,
                            Map<String, Object> attributes,
                            Authentication authentication,
                            String tenantId,
                            String oldState,
                            String newState) {
        if (guardExpression == null || guardExpression.isBlank()) {
            return true;
        }

        try {
            Expression expression = expressionCache.computeIfAbsent(guardExpression, parser::parseExpression);

            StandardEvaluationContext context = new StandardEvaluationContext();
            context.setVariable("attributes", attributes != null ? attributes : Map.of());
            context.setVariable("user", authentication);
            context.setVariable("tenantId", tenantId);
            context.setVariable("oldState", oldState);
            context.setVariable("newState", newState);

            Boolean result = expression.getValue(context, Boolean.class);
            return Boolean.TRUE.equals(result);
        } catch (Exception e) {
            log.error("Failed to evaluate FSM SpEL guard expression '{}': {}", guardExpression, e.getMessage());
            return false;
        }
    }
}
