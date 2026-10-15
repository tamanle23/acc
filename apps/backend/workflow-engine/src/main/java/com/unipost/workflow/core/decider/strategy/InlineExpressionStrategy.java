package com.unipost.workflow.core.decider.strategy;

import com.unipost.workflow.core.expression.ParameterResolver;
import com.unipost.workflow.core.model.EngineCommand;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.WorkflowSnapshot;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * INLINE expression system task:
 * Evaluates lightweight arithmetic, string manipulation, or logical expressions in-engine.
 * Resolves expressions such as:
 * - "expression": "100 * 0.15" or simple binary arithmetic (+, -, *, /)
 * - string concats and conversions
 */
public final class InlineExpressionStrategy implements NodeEvaluatorStrategy {

    @Override
    public NodeEvaluationResult evaluate(
        TaskDefinition taskDef,
        WorkflowSnapshot snapshot,
        long nowEpochMs,
        ParameterResolver resolver
    ) {
        String refName = taskDef.taskReferenceName();
        TaskSnapshot existing = snapshot.tasksByRef().get(refName);

        if (existing != null) {
            if (existing.status() == TaskStatus.COMPLETED) {
                return NodeEvaluationResult.completed(existing.outputData());
            } else if (existing.status() == TaskStatus.SKIPPED) {
                return NodeEvaluationResult.skipped();
            }
        }

        Map<String, Object> resolvedInput = resolver.resolve(taskDef.inputParameters(), snapshot);
        Map<String, Object> output = new LinkedHashMap<>();

        Object exprObj = resolvedInput.get("expression");
        if (exprObj instanceof String exprStr) {
            Object evalResult = evaluateSimpleExpression(exprStr.trim());
            output.put("result", evalResult);
        } else {
            output.putAll(resolvedInput);
        }

        List<EngineCommand> commands = new ArrayList<>();
        commands.add(new EngineCommand.UpdateTaskStatus(
            snapshot.workflowId() + "_" + refName,
            refName,
            TaskStatus.COMPLETED,
            output,
            null
        ));

        return new NodeEvaluationResult(TaskStatus.COMPLETED, commands, output, false);
    }

    private Object evaluateSimpleExpression(String expr) {
        try {
            // Check for simple binary arithmetic operations: op in [+, -, *, /]
            for (char op : new char[]{'+', '-', '*', '/'}) {
                int opIdx = expr.indexOf(op);
                if (opIdx > 0 && opIdx < expr.length() - 1) {
                    String leftStr = expr.substring(0, opIdx).trim();
                    String rightStr = expr.substring(opIdx + 1).trim();

                    try {
                        double left = Double.parseDouble(leftStr);
                        double right = Double.parseDouble(rightStr);
                        return switch (op) {
                            case '+' -> (left + right);
                            case '-' -> (left - right);
                            case '*' -> (left * right);
                            case '/' -> (right != 0 ? left / right : 0.0);
                            default -> expr;
                        };
                    } catch (NumberFormatException ignored) {
                        // Not numeric arithmetic; check for string concat
                        if (op == '+') {
                            return leftStr + rightStr;
                        }
                    }
                }
            }
            // Check boolean literals
            if ("true".equalsIgnoreCase(expr)) return true;
            if ("false".equalsIgnoreCase(expr)) return false;

            // Check numeric literal
            return Double.parseDouble(expr);
        } catch (Exception e) {
            // Fallback: return raw string
            return expr;
        }
    }
}
