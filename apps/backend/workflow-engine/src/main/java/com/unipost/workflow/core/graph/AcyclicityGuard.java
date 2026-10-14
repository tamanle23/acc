package com.unipost.workflow.core.graph;

import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.WorkflowDefinition;

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
        for (TaskDefinition task : tasks) {
            String toNode = task.taskReferenceName();
            if (task.joinOn() != null && !task.joinOn().isEmpty()) {
                for (String fromNode : task.joinOn()) {
                    if (adj.containsKey(fromNode)) {
                        if (adj.get(fromNode).add(toNode)) {
                            inDegree.put(toNode, inDegree.get(toNode) + 1);
                        }
                    }
                }
            }
        }

        // 2. Kahn's algorithm
        Deque<String> queue = new ArrayDeque<>();
        for (Map.Entry<String, Integer> entry : inDegree.entrySet()) {
            if (entry.getValue() == 0) {
                queue.add(entry.getKey());
            }
        }

        List<String> sortedOrder = new ArrayList<>();
        while (!queue.isEmpty()) {
            String current = queue.poll();
            sortedOrder.add(current);

            for (String neighbor : adj.getOrDefault(current, Collections.emptySet())) {
                int newInDegree = inDegree.get(neighbor) - 1;
                inDegree.put(neighbor, newInDegree);
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
