package com.unipost.service.workflow;

import org.springframework.security.core.Authentication;

import java.util.Map;

/**
 * Strategy interface for evaluating dynamic FSM guard expressions.
 */
public interface GuardEvaluatorStrategy {

    /**
     * Evaluates a guard expression against attributes and context variables.
     *
     * @param guardExpression the expression string (SpEL, CEL, etc.)
     * @param attributes      entity record attributes map
     * @param authentication  current authenticated principal
     * @param tenantId        active tenant boundary
     * @param oldState        current state of the record
     * @param newState        destination state of the requested transition
     * @return true if guard condition passes, false otherwise
     */
    boolean evaluate(String guardExpression,
                     Map<String, Object> attributes,
                     Authentication authentication,
                     String tenantId,
                     String oldState,
                     String newState);
}
