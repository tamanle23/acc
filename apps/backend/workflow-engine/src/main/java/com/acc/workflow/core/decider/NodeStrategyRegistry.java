package com.acc.workflow.core.decider;

import com.acc.workflow.core.decider.strategy.DoWhileStrategy;
import com.acc.workflow.core.decider.strategy.DynamicForkStrategy;
import com.acc.workflow.core.decider.strategy.ForkJoinStrategy;
import com.acc.workflow.core.decider.strategy.NodeEvaluatorStrategy;
import com.acc.workflow.core.decider.strategy.SimpleTaskStrategy;
import com.acc.workflow.core.decider.strategy.SwitchNodeStrategy;
import com.acc.workflow.core.decider.strategy.WaitNodeStrategy;
import com.acc.workflow.core.model.TaskType;

import com.acc.workflow.core.decider.strategy.CallMcpToolStrategy;
import com.acc.workflow.core.decider.strategy.DynamicTaskStrategy;
import com.acc.workflow.core.decider.strategy.EventNodeStrategy;
import com.acc.workflow.core.decider.strategy.ExclusiveJoinStrategy;
import com.acc.workflow.core.decider.strategy.HttpNodeStrategy;
import com.acc.workflow.core.decider.strategy.HumanNodeStrategy;
import com.acc.workflow.core.decider.strategy.InlineExpressionStrategy;
import com.acc.workflow.core.decider.strategy.JdbcNodeStrategy;
import com.acc.workflow.core.decider.strategy.JsonTransformStrategy;
import com.acc.workflow.core.decider.strategy.KafkaPublishStrategy;
import com.acc.workflow.core.decider.strategy.LlmChatCompleteStrategy;
import com.acc.workflow.core.decider.strategy.NoopNodeStrategy;
import com.acc.workflow.core.decider.strategy.SetVariableStrategy;
import com.acc.workflow.core.decider.strategy.StartWorkflowStrategy;
import com.acc.workflow.core.decider.strategy.SubWorkflowStrategy;
import com.acc.workflow.core.decider.strategy.TerminateNodeStrategy;

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
        register(TaskType.SET_VARIABLE, new SetVariableStrategy());
        register(TaskType.JSON_JQ_TRANSFORM, new JsonTransformStrategy());
        register(TaskType.INLINE, new InlineExpressionStrategy());
        register(TaskType.HTTP, new HttpNodeStrategy());
        register(TaskType.HUMAN, new HumanNodeStrategy());
        register(TaskType.JOIN, new ForkJoinStrategy());
        register(TaskType.EXCLUSIVE_JOIN, new ExclusiveJoinStrategy());
        register(TaskType.TERMINATE, new TerminateNodeStrategy());
        register(TaskType.SUB_WORKFLOW, new SubWorkflowStrategy());
        register(TaskType.START_WORKFLOW, new StartWorkflowStrategy());
        register(TaskType.EVENT, new EventNodeStrategy());
        register(TaskType.DYNAMIC, new DynamicTaskStrategy());
        register(TaskType.LLM_CHAT_COMPLETE, new LlmChatCompleteStrategy());
        register(TaskType.NOOP, new NoopNodeStrategy());
        register(TaskType.JDBC, new JdbcNodeStrategy());
        register(TaskType.KAFKA_PUBLISH, new KafkaPublishStrategy());
        register(TaskType.CALL_MCP_TOOL, new CallMcpToolStrategy());
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
