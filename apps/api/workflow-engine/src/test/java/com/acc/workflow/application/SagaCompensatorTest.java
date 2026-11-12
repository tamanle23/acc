package com.acc.workflow.application;

import com.acc.workflow.core.model.EngineCommand;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.TaskStatus;
import com.acc.workflow.core.model.TaskType;
import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.core.model.WorkflowSnapshot;
import com.acc.workflow.core.model.WorkflowStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class SagaCompensatorTest {

    @Test
    @DisplayName("SagaCompensator should plan compensation tasks in reverse order of completed tasks with compensateHandlerRef")
    void testReverseCompensation() {
        SagaCompensator compensator = new SagaCompensator();

        // Workflow definition with 3 tasks, all specifying compensation handlers
        WorkflowDefinition def = WorkflowDefinition.builder("flight-hotel-car-booking")
            .version(1)
            .addTask(TaskDefinition.builder("bookFlight")
                .taskType(TaskType.SIMPLE)
                .compensateHandlerRef("CANCEL_FLIGHT")
                .inputParameters(Map.of("flightNo", "VN123"))
                .build())
            .addTask(TaskDefinition.builder("bookHotel")
                .taskType(TaskType.SIMPLE)
                .compensateHandlerRef("CANCEL_HOTEL")
                .inputParameters(Map.of("hotelId", "HT_99"))
                .build())
            .addTask(TaskDefinition.builder("bookCar")
                .taskType(TaskType.SIMPLE)
                .compensateHandlerRef("CANCEL_CAR")
                .inputParameters(Map.of("carId", "CAR_77"))
                .build())
            .build();

        // Snapshot where bookFlight and bookHotel succeeded, but bookCar failed
        TaskSnapshot flightSnap = new TaskSnapshot(
            "wf_1_bookFlight", "bookFlight", TaskType.SIMPLE, "default",
            TaskStatus.COMPLETED, 1, Map.of("flightNo", "VN123"), Map.of("pnr", "PNR_999"), null, 0L, 30000L, "w1"
        );
        TaskSnapshot hotelSnap = new TaskSnapshot(
            "wf_1_bookHotel", "bookHotel", TaskType.SIMPLE, "default",
            TaskStatus.COMPLETED, 1, Map.of("hotelId", "HT_99"), Map.of("bookingRef", "BKG_456"), null, 0L, 30000L, "w1"
        );
        TaskSnapshot carSnap = new TaskSnapshot(
            "wf_1_bookCar", "bookCar", TaskType.SIMPLE, "default",
            TaskStatus.FAILED, 1, Map.of("carId", "CAR_77"), Map.of(), "No cars available", 0L, 30000L, "w1"
        );

        WorkflowSnapshot snapshot = new WorkflowSnapshot(
            "wf_1", "t1", "w1", "flight-hotel-car-booking", 1,
            WorkflowStatus.FAILED, Map.of(), Map.of(), "No cars available",
            Map.of(
                "bookFlight", flightSnap,
                "bookHotel", hotelSnap,
                "bookCar", carSnap
            )
        );

        long nowEpochMs = 1700000000000L;
        List<EngineCommand.ScheduleTask> plan = compensator.planCompensation(def, snapshot, nowEpochMs);

        // Verification:
        // bookCar was failed -> no compensation needed for it
        // bookHotel completed second -> must be compensated FIRST
        // bookFlight completed first -> must be compensated SECOND
        assertThat(plan).hasSize(2);

        EngineCommand.ScheduleTask firstComp = plan.get(0);
        assertThat(firstComp.taskType()).isEqualTo("CANCEL_HOTEL");
        assertThat(firstComp.referenceName()).isEqualTo("bookHotel_COMPENSATE");
        assertThat(firstComp.input()).containsEntry("hotelId", "HT_99");
        assertThat(firstComp.input()).containsEntry("_originalTaskId", "wf_1_bookHotel");

        EngineCommand.ScheduleTask secondComp = plan.get(1);
        assertThat(secondComp.taskType()).isEqualTo("CANCEL_FLIGHT");
        assertThat(secondComp.referenceName()).isEqualTo("bookFlight_COMPENSATE");
        assertThat(secondComp.input()).containsEntry("flightNo", "VN123");
        assertThat(secondComp.input()).containsEntry("_originalTaskId", "wf_1_bookFlight");
    }
}
