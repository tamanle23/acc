package com.acc.aio.controller.workflow;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class WorkerFleetControllerTest {

    private WorkerRegistry workerRegistry;
    private WorkerFleetController controller;

    @BeforeEach
    void setUp() {
        workerRegistry = new WorkerRegistry();
        controller = new WorkerFleetController(workerRegistry);
    }

    @Test
    @DisplayName("WorkerFleetController: Initial fleet query returns default seeded JVM worker")
    void testInitialFleetAndSeededWorker() {
        ResponseEntity<WorkerRegistry.WorkerFleetResponse> response = controller.getFleet();
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isNotNull();

        WorkerRegistry.WorkerFleetResponse body = response.getBody();
        assertThat(body.summary().totalWorkers()).isGreaterThanOrEqualTo(1);
        assertThat(body.summary().healthyCount()).isGreaterThanOrEqualTo(1);

        WorkerRegistry.WorkerRegistration jvmWorker = body.workers().stream()
            .filter(w -> w.workerId().contains("jvm"))
            .findFirst()
            .orElse(null);

        assertThat(jvmWorker).isNotNull();
        assertThat(jvmWorker.runtime()).isEqualTo("JAVA_VIRTUAL_THREADS");
        assertThat(jvmWorker.status()).isEqualTo("HEALTHY");
    }

    @Test
    @DisplayName("WorkerFleetController: Registers Node.js and Java workers, and computes telemetry metrics")
    void testHeartbeatRegistrationAndAging() {
        long now = System.currentTimeMillis();

        // 1. Register Node.js worker
        WorkerFleetController.HeartbeatRequest nodeReq = new WorkerFleetController.HeartbeatRequest(
            "worker-node-agent-01",
            "10.0.1.20",
            "NODEJS_WORKER",
            List.of("ai-agents", "integrations"),
            32,
            5,
            120L,
            0L,
            3600L
        );
        ResponseEntity<?> nodeRes = controller.heartbeat(nodeReq);
        assertThat(nodeRes.getStatusCode()).isEqualTo(HttpStatus.OK);

        // 2. Query fleet and verify aggregated summary
        ResponseEntity<WorkerRegistry.WorkerFleetResponse> fleetRes = controller.getFleet();
        WorkerRegistry.WorkerFleetResponse fleet = fleetRes.getBody();
        assertThat(fleet).isNotNull();
        assertThat(fleet.summary().activeLeases()).isGreaterThanOrEqualTo(5);
        assertThat(fleet.summary().totalCompletedTasks()).isGreaterThanOrEqualTo(120L);

        WorkerRegistry.WorkerRegistration nodeWorker = fleet.workers().stream()
            .filter(w -> "worker-node-agent-01".equals(w.workerId()))
            .findFirst()
            .orElse(null);

        assertThat(nodeWorker).isNotNull();
        assertThat(nodeWorker.runtime()).isEqualTo("NODEJS_WORKER");
        assertThat(nodeWorker.status()).isEqualTo("HEALTHY");
    }

    @Test
    @DisplayName("WorkerFleetController: Drain worker successfully transitions worker to DRAINING status")
    void testDrainWorker() {
        long now = System.currentTimeMillis();
        workerRegistry.registerOrHeartbeat(
            "worker-to-drain-01",
            "10.0.2.15",
            "JAVA_VIRTUAL_THREADS",
            List.of("orders"),
            64,
            2,
            50L,
            0L,
            7200L,
            now
        );

        ResponseEntity<?> drainRes = controller.drainWorker("worker-to-drain-01");
        assertThat(drainRes.getStatusCode()).isEqualTo(HttpStatus.OK);

        ResponseEntity<WorkerRegistry.WorkerFleetResponse> fleetRes = controller.getFleet();
        WorkerRegistry.WorkerRegistration drainedWorker = fleetRes.getBody().workers().stream()
            .filter(w -> "worker-to-drain-01".equals(w.workerId()))
            .findFirst()
            .orElse(null);

        assertThat(drainedWorker).isNotNull();
        assertThat(drainedWorker.status()).isEqualTo("DRAINING");

        // Verify non-existent worker returns 404
        ResponseEntity<?> notFoundRes = controller.drainWorker("worker-non-existent");
        assertThat(notFoundRes.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
