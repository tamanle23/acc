package com.unipost.workflow.core.decider;

import com.unipost.workflow.core.decider.strategy.DoWhileStrategy;
import com.unipost.workflow.core.decider.strategy.DynamicForkStrategy;
import com.unipost.workflow.core.decider.strategy.ForkJoinStrategy;
import com.unipost.workflow.core.decider.strategy.NodeEvaluatorStrategy;
import com.unipost.workflow.core.decider.strategy.SimpleTaskStrategy;
import com.unipost.workflow.core.decider.strategy.SwitchNodeStrategy;
import com.unipost.workflow.core.decider.strategy.WaitNodeStrategy;
import com.unipost.workflow.core.model.TaskType;

import java.util.EnumMap;
import java.util.Map;

/**
 * Open/Closed Registry mapping TaskType to NodeEvaluatorStrategy.
 * Never uses hardcoded switch/if-else blocks inside PureDecider.
 */
public final class NodeStrategyRegistry {

    private final Map<TaskType, NodeEvaluatorStrategy> strategies = new EnumMap<>(TaskType.class);

    public NodeStrategyRegistry() {
        registerDefaultStrategies();
    }

    private void registerDefaultStrategies() {
        register(TaskType.SIMPLE, new SimpleTaskStrategy());
        register(TaskType.SWITCH, new SwitchNodeStrategy());
        register(TaskType.FORK_JOIN, new ForkJoinStrategy());
        register(TaskType.DYNAMIC_FORK, new DynamicForkStrategy());
        register(TaskType.WAIT, new WaitNodeStrategy());
        register(TaskType.DO_WHILE, new DoWhileStrategy());
    }

    public void register(TaskType taskType, NodeEvaluatorStrategy strategy) {
        if (taskType == null || strategy == null) {
            throw new IllegalArgumentException("taskType and strategy cannot be null");
        }
        strategies.put(taskType, strategy);
    }

    public NodeEvaluatorStrategy get(TaskType taskType) {
        NodeEvaluatorStrategy strategy = strategies.get(taskType);
        if (strategy == null) {
            throw new IllegalStateException("No strategy registered for task type: " + taskType);
        }
        return strategy;
    }
}
