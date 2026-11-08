package com.acc.aio.controller.workflow;

import com.acc.workflow.core.schema.BuiltInTaskContracts;
import com.acc.workflow.core.schema.TaskTypeContract;
import com.acc.workflow.worker.TaskWorkerDescriptor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.*;

@RestController
@RequestMapping("/api/v1/tasks")
public class TaskContractController {

    private final WorkerRegistry workerRegistry;

    public TaskContractController(WorkerRegistry workerRegistry) {
        this.workerRegistry = workerRegistry;
    }

    @GetMapping("/contracts")
    public ResponseEntity<List<TaskTypeContract>> getAllContracts() {
        Map<String, TaskTypeContract> unified = new LinkedHashMap<>();

        // 1. Load canonical built-in contracts (all 24 TaskType values)
        for (TaskTypeContract contract : BuiltInTaskContracts.getContracts().values()) {
            unified.put(contract.taskType(), contract);
        }

        // 2. Overlay or register dynamic worker fleet capabilities
        if (workerRegistry != null) {
            for (TaskWorkerDescriptor worker : workerRegistry.getTaskCatalog()) {
                List<Map<String, Object>> params = extractParamDescriptors(worker.inputSchema());
                TaskTypeContract workerContract = new TaskTypeContract(
                    worker.taskName(),
                    "WORKER",
                    worker.description() != null ? worker.description() : "Domain worker task (" + worker.domain() + ")",
                    worker.inputSchema() != null ? worker.inputSchema() : Map.of(),
                    worker.outputSchema() != null ? worker.outputSchema() : Map.of(),
                    params
                );
                unified.put(worker.taskName(), workerContract);
            }
        }

        return ResponseEntity.ok(new ArrayList<>(unified.values()));
    }

    @GetMapping("/contracts/{taskType}")
    public ResponseEntity<TaskTypeContract> getContract(@PathVariable String taskType) {
        if (workerRegistry != null) {
            for (TaskWorkerDescriptor worker : workerRegistry.getTaskCatalog()) {
                if (worker.taskName().equalsIgnoreCase(taskType)) {
                    List<Map<String, Object>> params = extractParamDescriptors(worker.inputSchema());
                    return ResponseEntity.ok(new TaskTypeContract(
                        worker.taskName(),
                        "WORKER",
                        worker.description() != null ? worker.description() : "Domain worker task (" + worker.domain() + ")",
                        worker.inputSchema() != null ? worker.inputSchema() : Map.of(),
                        worker.outputSchema() != null ? worker.outputSchema() : Map.of(),
                        params
                    ));
                }
            }
        }

        return BuiltInTaskContracts.get(taskType.toUpperCase())
            .map(ResponseEntity::ok)
            .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> extractParamDescriptors(Map<String, Object> inputSchema) {
        if (inputSchema == null || !inputSchema.containsKey("properties")) {
            return Collections.emptyList();
        }
        Object propsObj = inputSchema.get("properties");
        if (!(propsObj instanceof Map<?, ?> propsMap)) {
            return Collections.emptyList();
        }
        List<String> requiredList = Collections.emptyList();
        if (inputSchema.containsKey("required") && inputSchema.get("required") instanceof List<?> rList) {
            requiredList = (List<String>) (List<?>) rList;
        }

        List<Map<String, Object>> params = new ArrayList<>();
        for (Map.Entry<?, ?> entry : propsMap.entrySet()) {
            String key = String.valueOf(entry.getKey());
            Map<String, Object> param = new LinkedHashMap<>();
            param.put("key", key);
            param.put("label", key);
            param.put("required", requiredList.contains(key));
            if (entry.getValue() instanceof Map<?, ?> def) {
                if (def.containsKey("type")) param.put("type", def.get("type"));
                if (def.containsKey("description")) param.put("description", def.get("description"));
                if (def.containsKey("default")) param.put("defaultValue", def.get("default"));
                if (def.containsKey("example")) param.put("exampleValue", def.get("example"));
            }
            params.add(param);
        }
        return params;
    }
}
