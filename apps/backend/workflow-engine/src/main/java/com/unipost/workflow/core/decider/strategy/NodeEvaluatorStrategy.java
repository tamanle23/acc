package com.unipost.workflow.core.decider.strategy;

import com.unipost.workflow.core.expression.ParameterResolver;
import com.unipost.workflow.core.model.EngineCommand;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.WorkflowSnapshot;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Strategy interface for evaluating a workflow task node.
 * Implementations are strictly pure, synchronous, and zero-I/O.
 */
public interface NodeEvaluatorStrategy {

    record NodeEvaluationResult(
        TaskStatus nodeStatus,
        List<EngineCommand> commands,
        Map<String, Object> output,
        boolean shouldHaltProgression
    ) {
        public static NodeEvaluationResult scheduled(List<EngineCommand> commands) {
            return new NodeEvaluationResult(TaskStatus.SCHEDULED, commands, Collections.emptyMap(), true);
        }

        public static NodeEvaluationResult inProgress() {
            return new NodeEvaluationResult(TaskStatus.IN_PROGRESS, Collections.emptyList(), Collections.emptyMap(), true);
        }

        public static NodeEvaluationResult completed(Map<String, Object> output) {
            return new NodeEvaluationResult(TaskStatus.COMPLETED, Collections.emptyList(), output, false);
        }

        public static NodeEvaluationResult skipped() {
            return new NodeEvaluationResult(TaskStatus.SKIPPED, Collections.emptyList(), Collections.emptyMap(), false);
        }

        public static NodeEvaluationResult failed(List<EngineCommand> commands, String error) {
            return new NodeEvaluationResult(TaskStatus.FAILED, commands, Collections.emptyMap(), true);
        }
    }

    NodeEvaluationResult evaluate(
        TaskDefinition taskDef,
        WorkflowSnapshot snapshot,
        long nowEpochMs,
        ParameterResolver resolver
    );
}
