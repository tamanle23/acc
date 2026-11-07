package com.acc.workflow.core.graph;

import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskType;
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
 * Mathematically verifies graph acyclicity and topological invariants before workflow registration or execution.
 * 1. Partitions edges into forward edges (E_forward) and reducible loop back-edges (E_back) for DO_WHILE.
 * 2. Enforces 4-Point Loop Integrity Invariants on DO_WHILE loop subgraphs.
 * 3. Kahn's Algorithm (O(V + E)) on G_DAG = (V, E_forward) for topological sorting and cycle detection.
 * 4. Tarjan's Strongly Connected Components (SCC) to extract the exact cycle path if a non-loop cycle exists.
 * 5. Strict canonical boundary checks: exactly 1 START_WORKFLOW (in=0) and 1 END_WORKFLOW (out=0).
 */
public final class AcyclicityGuard {

    private record Edge(String from, String to) {}

    public List<String> validateAndSort(WorkflowDefinition definition) {
        if (definition == null || definition.tasks().isEmpty()) {
            return Collections.emptyList();
        }

        List<TaskDefinition> tasks = definition.tasks();
        Map<String, TaskDefinition> taskMap = new LinkedHashMap<>();
        for (TaskDefinition task : tasks) {
            taskMap.put(task.taskReferenceName(), task);
        }

        // 1. Reconstruct all raw directed edges
        Map<String, Set<String>> rawAdj = new LinkedHashMap<>();
        for (TaskDefinition task : tasks) {
            rawAdj.putIfAbsent(task.taskReferenceName(), new LinkedHashSet<>());
        }

        boolean hasAnyJoinOn = tasks.stream().anyMatch(t -> t.joinOn() != null && !t.joinOn().isEmpty());
        if (!hasAnyJoinOn && tasks.size() > 1) {
            // Implicit linear sequential pipeline: each task depends on the preceding task
            for (int i = 1; i < tasks.size(); i++) {
                String fromNode = tasks.get(i - 1).taskReferenceName();
                String toNode = tasks.get(i).taskReferenceName();
                rawAdj.get(fromNode).add(toNode);
            }
        } else {
            for (TaskDefinition task : tasks) {
                String toNode = task.taskReferenceName();
                if (task.joinOn() != null && !task.joinOn().isEmpty()) {
                    for (String fromNode : task.joinOn()) {
                        if (rawAdj.containsKey(fromNode)) {
                            rawAdj.get(fromNode).add(toNode);
                        }
                    }
                }
            }
        }

        // 2. Partition edges into E_forward and E_back for DO_WHILE structured loops
        Set<Edge> backEdges = new HashSet<>();
        List<TaskDefinition> doWhileTasks = tasks.stream()
            .filter(t -> t.taskType() == TaskType.DO_WHILE)
            .toList();

        for (TaskDefinition doWhileTask : doWhileTasks) {
            String loopRef = doWhileTask.taskReferenceName();
            validateAndExtractLoopBackEdges(loopRef, rawAdj, taskMap, backEdges);
        }

        // 3. Construct reduced DAG G_DAG = (V, E_forward)
        Map<String, Set<String>> adj = new LinkedHashMap<>();
        Map<String, Integer> inDegree = new LinkedHashMap<>();
        Map<String, Integer> outDegree = new LinkedHashMap<>();

        for (TaskDefinition task : tasks) {
            String ref = task.taskReferenceName();
            adj.putIfAbsent(ref, new LinkedHashSet<>());
            inDegree.putIfAbsent(ref, 0);
            outDegree.putIfAbsent(ref, 0);
        }

        for (Map.Entry<String, Set<String>> entry : rawAdj.entrySet()) {
            String fromNode = entry.getKey();
            for (String toNode : entry.getValue()) {
                if (backEdges.contains(new Edge(fromNode, toNode))) {
                    continue; // Skip loopback edge in DAG topological sort
                }
                if (adj.get(fromNode).add(toNode)) {
                    inDegree.put(toNode, inDegree.get(toNode) + 1);
                    outDegree.put(fromNode, outDegree.get(fromNode) + 1);
                }
            }
        }

        // 4. Kahn's algorithm for cycle detection on G_DAG
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
            // Cycle detected! Extract cycle using Tarjan SCC on G_DAG
            List<String> cyclePath = findCyclePath(adj);
            throw new WorkflowCycleDetectedException(cyclePath);
        }

        // 5. Enforce Single Start and Single End Topological Invariant (tasks > 1)
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

            Set<String> backEdgeOrigins = new HashSet<>();
            for (Edge be : backEdges) {
                backEdgeOrigins.add(be.from());
            }

            List<String> endNodes = new ArrayList<>();
            for (Map.Entry<String, Integer> entry : outDegree.entrySet()) {
                if (entry.getValue() == 0 && !backEdgeOrigins.contains(entry.getKey())) {
                    endNodes.add(entry.getKey());
                }
            }
            if (endNodes.size() > 1) {
                throw new WorkflowTopologyException("Workflow definition must have exactly one end node, found " + endNodes.size() + ": " + endNodes);
            }
            if (endNodes.isEmpty()) {
                throw new WorkflowTopologyException("Workflow definition must have at least one end node (found 0, graph has cycles)");
            }

            // Boundary type verification
            String singleStartRef = startNodes.get(0);
            TaskDefinition startDef = taskMap.get(singleStartRef);
            if (startDef != null && tasks.stream().anyMatch(t -> t.taskType() == TaskType.START_WORKFLOW)) {
                if (startDef.taskType() != TaskType.START_WORKFLOW) {
                    throw new WorkflowTopologyException("Root start node '" + singleStartRef + "' must be of type START_WORKFLOW");
                }
            }

            String singleEndRef = endNodes.get(0);
            TaskDefinition endDef = taskMap.get(singleEndRef);
            if (endDef != null && tasks.stream().anyMatch(t -> t.taskType() == TaskType.END_WORKFLOW)) {
                if (endDef.taskType() != TaskType.END_WORKFLOW) {
                    throw new WorkflowTopologyException("Terminal exit node '" + singleEndRef + "' must be of type END_WORKFLOW");
                }
            }

            // 6. Enforce FORK_JOIN and JOIN pairing
            boolean hasFork = tasks.stream().anyMatch(t -> t.taskType() == TaskType.FORK_JOIN);
            if (hasFork) {
                boolean hasJoin = tasks.stream().anyMatch(t -> t.taskType() == TaskType.JOIN || t.taskType() == TaskType.EXCLUSIVE_JOIN);
                if (!hasJoin) {
                    throw new WorkflowTopologyException("Workflow contains FORK_JOIN task but no matching JOIN barrier task");
                }
            }

            // 7. Enforce DO_WHILE exit branch presence
            for (TaskDefinition doWhile : doWhileTasks) {
                if (outDegree.getOrDefault(doWhile.taskReferenceName(), 0) == 0 && endNodes.size() == 1 && !endNodes.contains(doWhile.taskReferenceName())) {
                    throw new WorkflowTopologyException("DO_WHILE loop '" + doWhile.taskReferenceName() + "' must have a downstream exit branch.");
                }
            }
        }

        return Collections.unmodifiableList(sortedOrder);
    }

    private void validateAndExtractLoopBackEdges(
        String loopRef,
        Map<String, Set<String>> rawAdj,
        Map<String, TaskDefinition> taskMap,
        Set<Edge> backEdges
    ) {
        // Collect candidate incoming edges to loopRef that originate downstream of loopRef
        List<String> incomingToLoop = new ArrayList<>();
        for (Map.Entry<String, Set<String>> entry : rawAdj.entrySet()) {
            if (entry.getValue().contains(loopRef)) {
                incomingToLoop.add(entry.getKey());
            }
        }

        // Trace nodes reachable from loopRef without traversing back to loopRef
        Set<String> forwardReachable = new HashSet<>();
        Deque<String> q = new ArrayDeque<>();
        for (String child : rawAdj.getOrDefault(loopRef, Collections.emptySet())) {
            if (!child.equals(loopRef)) {
                forwardReachable.add(child);
                q.add(child);
            }
        }

        while (!q.isEmpty()) {
            String curr = q.poll();
            for (String next : rawAdj.getOrDefault(curr, Collections.emptySet())) {
                if (!next.equals(loopRef) && forwardReachable.add(next)) {
                    q.add(next);
                }
            }
        }

        List<String> loopBackSources = new ArrayList<>();
        for (String inRef : incomingToLoop) {
            if (forwardReachable.contains(inRef)) {
                loopBackSources.add(inRef);
            }
        }

        if (loopBackSources.size() > 1) {
            throw new WorkflowTopologyException(
                "DO_WHILE loop '" + loopRef + "' has multiple incoming loopback edges from: " + loopBackSources +
                ". Parallel branches inside the loop must converge via a JOIN before looping back."
            );
        }

        if (!loopBackSources.isEmpty()) {
            String backSource = loopBackSources.get(0);
            backEdges.add(new Edge(backSource, loopRef));

            // Validate Invariant 3: Zero leakage / unhandled branches outside loop body
            // Nodes strictly in the loop body cannot branch directly to external nodes (except loopRef)
            Set<String> loopBodyNodes = new HashSet<>();
            Deque<String> bodyQ = new ArrayDeque<>();
            for (String child : rawAdj.getOrDefault(loopRef, Collections.emptySet())) {
                // If child is in forwardReachable and can reach backSource
                if (canReach(child, backSource, rawAdj, loopRef)) {
                    loopBodyNodes.add(child);
                    bodyQ.add(child);
                }
            }

            while (!bodyQ.isEmpty()) {
                String curr = bodyQ.poll();
                for (String next : rawAdj.getOrDefault(curr, Collections.emptySet())) {
                    if (!next.equals(loopRef) && canReach(next, backSource, rawAdj, loopRef) && loopBodyNodes.add(next)) {
                        bodyQ.add(next);
                    }
                }
            }

            for (String bodyNode : loopBodyNodes) {
                for (String dest : rawAdj.getOrDefault(bodyNode, Collections.emptySet())) {
                    if (!dest.equals(loopRef) && !loopBodyNodes.contains(dest)) {
                        throw new WorkflowTopologyException(
                            "Task '" + bodyNode + "' inside loop body '" + loopRef +
                            "' connects to external node '" + dest + "'. Tasks inside a loop body cannot exit the loop directly."
                        );
                    }
                }
            }
        }
    }

    private boolean canReach(String start, String target, Map<String, Set<String>> adj, String avoid) {
        if (start.equals(target)) return true;
        Set<String> visited = new HashSet<>();
        Deque<String> q = new ArrayDeque<>();
        visited.add(start);
        q.add(start);

        while (!q.isEmpty()) {
            String curr = q.poll();
            if (curr.equals(target)) return true;
            for (String next : adj.getOrDefault(curr, Collections.emptySet())) {
                if (!next.equals(avoid) && visited.add(next)) {
                    q.add(next);
                }
            }
        }
        return false;
    }

    private List<String> findCyclePath(Map<String, Set<String>> adj) {
        Set<String> visited = new HashSet<>();
        Set<String> onStack = new HashSet<>();
        List<String> path = new ArrayList<>();

        for (String node : adj.keySet()) {
            if (dfsCycle(node, adj, visited, onStack, path)) {
                Collections.reverse(path);
                return path;
            }
        }
        return List.of("cycle_detected");
    }

    private boolean dfsCycle(String current, Map<String, Set<String>> adj, Set<String> visited, Set<String> onStack, List<String> path) {
        visited.add(current);
        onStack.add(current);

        for (String neighbor : adj.getOrDefault(current, Collections.emptySet())) {
            if (!visited.contains(neighbor)) {
                if (dfsCycle(neighbor, adj, visited, onStack, path)) {
                    path.add(current);
                    return true;
                }
            } else if (onStack.contains(neighbor)) {
                path.add(neighbor);
                path.add(current);
                return true;
            }
        }

        onStack.remove(current);
        return false;
    }
}
