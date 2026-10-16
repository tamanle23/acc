package com.unipost.aio.controller.workflow;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/workflow/workers")
public class WorkerFleetController {

    private final WorkerRegistry workerRegistry;

    public WorkerFleetController(WorkerRegistry workerRegistry) {
        this.workerRegistry = workerRegistry;
    }

    public record HeartbeatRequest(
        String workerId,
        String hostIp,
        String runtime,
        List<String> pollDomains,
        Integer concurrencyLimit,
        Integer activeLeases,
        Long tasksCompletedCount,
        Long errorCount,
        Long uptimeSeconds
    ) {}

    @GetMapping
    public ResponseEntity<WorkerRegistry.WorkerFleetResponse> getFleet() {
        long now = System.currentTimeMillis();
        return ResponseEntity.ok(workerRegistry.getFleet(now));
    }

    @PostMapping("/heartbeat")
    public ResponseEntity<?> heartbeat(@RequestBody HeartbeatRequest req) {
        if (req == null || req.workerId() == null || req.workerId().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "workerId is required"));
        }
        long now = System.currentTimeMillis();
        WorkerRegistry.WorkerRegistration reg = workerRegistry.registerOrHeartbeat(
            req.workerId(),
            req.hostIp(),
            req.runtime(),
            req.pollDomains(),
            req.concurrencyLimit() != null ? req.concurrencyLimit() : 64,
            req.activeLeases() != null ? req.activeLeases() : 0,
            req.tasksCompletedCount() != null ? req.tasksCompletedCount() : 0L,
            req.errorCount() != null ? req.errorCount() : 0L,
            req.uptimeSeconds() != null ? req.uptimeSeconds() : 1L,
            now
        );
        return ResponseEntity.ok(Map.of(
            "success", true,
            "worker", reg
        ));
    }

    @PostMapping("/{workerId}/drain")
    public ResponseEntity<?> drainWorker(@PathVariable("workerId") String workerId) {
        boolean drained = workerRegistry.drainWorker(workerId);
        if (!drained) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of(
                "error", "Worker not found",
                "workerId", workerId
            ));
        }
        return ResponseEntity.ok(Map.of(
            "success", true,
            "message", "Worker " + workerId + " transitioned to DRAINING"
        ));
    }
}
