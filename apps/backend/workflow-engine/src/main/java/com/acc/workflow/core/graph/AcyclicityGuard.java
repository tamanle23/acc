package com.acc.workflow.core.graph;

import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.WorkflowDefinition;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Mathematically verifies graph acyclicity before workflow registration or execution.
 * 1. Kahn's Algorithm (O(V + E)) for topological sorting and cycle detection.
 * 2. Tarjan's Strongly Connected Components (SCC) to extract the exact cycle path if a cycle is found.
 */
public final class AcyclicityGuard {

    public List<String> validateAndSort(WorkflowDefinition definition) {
        if (definition == null || definition.tasks().isEmpty()) {
            return Collections.emptyList();
        }

        List<TaskDefinition> tasks = definition.tasks();
        Map<String, Set<String>> adj = new LinkedHashMap<>();
        Map<String, Integer> inDegree = new LinkedHashMap<>();

        // Initialize nodes
        for (TaskDefinition task : tasks) {
            adj.putIfAbsent(task.taskReferenceName(), new LinkedHashSet<>());
            inDegree.putIfAbsent(task.taskReferenceName(), 0);
        }

        // Build edges
        // 1. Join dependencies: joinOn lists prerequisite task references
        Map<String, Integer> outDegree = new LinkedHashMap<>();
        for (TaskDefinition task : tasks) {
            outDegree.putIfAbsent(task.taskReferenceName(), 0);
        }

        boolean hasAnyJoinOn = tasks.stream().anyMatch(t -> t.joinOn() != null && !t.joinOn().isEmpty());
        if (!hasAnyJoinOn && tasks.size() > 1) {
            // Implicit linear sequential pipeline: each task depends on the preceding task
            for (int i = 1; i < tasks.size(); i++) {
                String fromNode = tasks.get(i - 1).taskReferenceName();
                String toNode = tasks.get(i).taskReferenceName();
                if (adj.get(fromNode).add(toNode)) {
                    inDegree.put(toNode, inDegree.get(toNode) + 1);
                    outDegree.put(fromNode, outDegree.get(fromNode) + 1);
                }
            }
        } else {
            for (TaskDefinition task : tasks) {
                String toNode = task.taskReferenceName();
                if (task.joinOn() != null && !task.joinOn().isEmpty()) {
                    for (String fromNode : task.joinOn()) {
                        if (adj.containsKey(fromNode)) {
                            if (adj.get(fromNode).add(toNode)) {
                                inDegree.put(toNode, inDegree.get(toNode) + 1);
                                outDegree.put(fromNode, outDegree.get(fromNode) + 1);
                            }
                        }
                    }
                }
            }
        }

        // 2. Kahn's algorithm for cycle detection
        Deque<String> queue = new ArrayDeque<>();
        for (Map.Entry<String, Integer> entry : inDegree.entrySet()) {
            if (entry.getValue() == 0) {
                queue.add(entry.getKey());
            }
        }

        Map<String, Integer> inDegreeCopy = new HashMap<>(inDegree);
        List<String> sortedOrder = new ArrayList<>();
        while (!queue.isEmpty()) {
            String current = queue.poll();
            sortedOrder.add(current);

            for (String neighbor : adj.getOrDefault(current, Collections.emptySet())) {
                int newInDegree = inDegreeCopy.get(neighbor) - 1;
                inDegreeCopy.put(neighbor, newInDegree);
                if (newInDegree == 0) {
                    queue.add(neighbor);
                }
            }
        }

        if (sortedOrder.size() != inDegree.size()) {
            // Cycle detected! Extract cycle using Tarjan SCC
            List<String> cyclePath = findCyclePath(adj);
            throw new WorkflowCycleDetectedException(cyclePath);
        }

        // 3. Enforce Single Start and Single End Topological Invariant (tasks > 1)
        if (tasks.size() > 1) {
            List<String> startNodes = new ArrayList<>();
            for (Map.Entry<String, Integer> entry : inDegree.entrySet()) {
                if (entry.getValue() == 0) {
                    startNodes.add(entry.getKey());
                }
            }
            if (startNodes.size() > 1) {
                throw new WorkflowTopologyException("Workflow definition must have exactly one start node, found " + startNodes.size() + ": " + startNodes);
            }
            if (startNodes.isEmpty()) {
                throw new WorkflowTopologyException("Workflow definition must have at least one start node (found 0, graph has cycles)");
            }

            List<String> endNodes = new ArrayList<>();
            for (Map.Entry<String, Integer> entry : outDegree.entrySet()) {
                if (entry.getValue() == 0) {
                    endNodes.add(entry.getKey());
                }
            }
            if (endNodes.size() > 1) {
                throw new WorkflowTopologyException("Workflow definition must have exactly one end node, found " + endNodes.size() + ": " + endNodes);
            }
            if (endNodes.isEmpty()) {
                throw new WorkflowTopologyException("Workflow definition must have at least one end node (found 0, graph has cycles)");
            }

            // 4. Enforce FORK_JOIN and JOIN pairing
            boolean hasFork = tasks.stream().anyMatch(t -> t.taskType() == com.acc.workflow.core.model.TaskType.FORK_JOIN);
            if (hasFork) {
                boolean hasJoin = tasks.stream().anyMatch(t -> t.taskType() == com.acc.workflow.core.model.TaskType.JOIN);
                if (!hasJoin) {
                    throw new WorkflowTopologyException("Workflow contains FORK_JOIN task but no matching JOIN barrier task");
                }
            }
        }

        return Collections.unmodifiableList(sortedOrder);
    }

    private List<String> findCyclePath(Map<String, Set<String>> adj) {
        // DFS cycle finder to trace exact cycle path
        Set<String> visited = new HashSet<>();
        Set<String> onStack = new HashSet<>();
        List<String> path = new ArrayList<>();

        for (String node : adj.keySet()) {
            if (!visited.contains(node)) {
                List<String> cycle = dfsTraceCycle(node, adj, visited, onStack, path);
                if (cycle != null && !cycle.isEmpty()) {
                    return cycle;
                }
            }
        }

        return List.of("UNKNOWN_CYCLE");
    }

    private List<String> dfsTraceCycle(
        String current,
        Map<String, Set<String>> adj,
        Set<String> visited,
        Set<String> onStack,
        List<String> path
    ) {
        visited.add(current);
        onStack.add(current);
        path.add(current);

        for (String neighbor : adj.getOrDefault(current, Collections.emptySet())) {
            if (!visited.contains(neighbor)) {
                List<String> cycle = dfsTraceCycle(neighbor, adj, visited, onStack, path);
                if (cycle != null) {
                    return cycle;
                }
            } else if (onStack.contains(neighbor)) {
                // Cycle closed! Extract slice from neighbor to end + neighbor
                int startIdx = path.indexOf(neighbor);
                List<String> cycle = new ArrayList<>(path.subList(startIdx, path.size()));
                cycle.add(neighbor);
                return cycle;
            }
        }

        onStack.remove(current);
        path.remove(path.size() - 1);
        return null;
    }
}
