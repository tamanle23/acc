package com.unipost.workflow.adapters.transport;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.ports.WorkerTransportPort;
import com.unipost.workflow.worker.TaskWorkerDescriptor;

import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Remote HTTP Transport Adapter for polyglot / external JVM workers connecting to
 * the Unipost Workflow Engine over REST/HTTP.
 */
public final class HttpWorkerTransportAdapter implements WorkerTransportPort {

    private final String baseUrl;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final Map<String, String> defaultHeaders;

    public HttpWorkerTransportAdapter(String baseUrl) {
        this(baseUrl, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build(), Collections.emptyMap());
    }

    public HttpWorkerTransportAdapter(String baseUrl, HttpClient httpClient, Map<String, String> defaultHeaders) {
        this.baseUrl = Objects.requireNonNull(baseUrl, "baseUrl required").replaceAll("/+$", "");
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient required");
        this.objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());
        this.defaultHeaders = defaultHeaders != null ? Map.copyOf(defaultHeaders) : Collections.emptyMap();
    }

    public boolean registerWorker(
        String workerId,
        String hostIp,
        String runtime,
        List<String> pollDomains,
        int concurrencyLimit,
        List<TaskWorkerDescriptor> supportedTasks
    ) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("workerId", workerId);
            payload.put("hostIp", hostIp != null ? hostIp : "127.0.0.1");
            payload.put("runtime", runtime != null ? runtime : "JAVA_VIRTUAL_THREADS");
            payload.put("pollDomains", pollDomains != null ? pollDomains : List.of("default"));
            payload.put("concurrencyLimit", concurrencyLimit);
            payload.put("supportedTasks", supportedTasks != null ? supportedTasks : Collections.emptyList());

            String body = objectMapper.writeValueAsString(payload);
            HttpRequest.Builder req = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/api/v1/workflow/workers/register"))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body));
            defaultHeaders.forEach(req::header);

            HttpResponse<String> res = httpClient.send(req.build(), HttpResponse.BodyHandlers.ofString());
            return res.statusCode() >= 200 && res.statusCode() < 300;
        } catch (Exception e) {
            return false;
        }
    }

    @Override
    public List<TaskSnapshot> pollBatch(
        String tenantId, String taskType, String domain, int batchSize, String workerId
    ) {
        try {
            String query = String.format(
                "tenantId=%s&taskType=%s&domain=%s&batchSize=%d&workerId=%s",
                encode(tenantId), encode(taskType), encode(domain), batchSize, encode(workerId)
            );
            HttpRequest.Builder req = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/api/v1/workflow/tasks/poll?" + query))
                .timeout(Duration.ofSeconds(15))
                .header("Accept", "application/json")
                .GET();
            if (tenantId != null && !tenantId.isBlank()) {
                req.header("X-Tenant-Id", tenantId);
            }
            defaultHeaders.forEach(req::header);

            HttpResponse<String> res = httpClient.send(req.build(), HttpResponse.BodyHandlers.ofString());
            if (res.statusCode() == 200 && res.body() != null && !res.body().isBlank()) {
                return objectMapper.readValue(res.body(), new TypeReference<List<TaskSnapshot>>() {});
            }
            return Collections.emptyList();
        } catch (Exception e) {
            return Collections.emptyList();
        }
    }

    @Override
    public void reportTaskResult(
        String taskId, String workerId, boolean completed, Map<String, Object> output,
        String errorMessage, long callbackAfterSeconds
    ) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("workerId", workerId);
            payload.put("completed", completed);
            payload.put("output", output != null ? output : Collections.emptyMap());
            payload.put("error", errorMessage);
            payload.put("callbackAfterSeconds", callbackAfterSeconds);

            String body = objectMapper.writeValueAsString(payload);
            HttpRequest.Builder req = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/api/v1/workflow/tasks/" + encode(taskId) + "/result"))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body));
            defaultHeaders.forEach(req::header);

            httpClient.send(req.build(), HttpResponse.BodyHandlers.ofString());
        } catch (Exception e) {
            throw new RuntimeException("Failed to report task result over HTTP for taskId=" + taskId, e);
        }
    }

    @Override
    public boolean heartbeat(String taskId, String workerId) {
        try {
            String body = objectMapper.writeValueAsString(Map.of("workerId", workerId));
            HttpRequest.Builder req = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + "/api/v1/workflow/tasks/" + encode(taskId) + "/heartbeat"))
                .timeout(Duration.ofSeconds(5))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body));
            defaultHeaders.forEach(req::header);

            HttpResponse<String> res = httpClient.send(req.build(), HttpResponse.BodyHandlers.ofString());
            return res.statusCode() >= 200 && res.statusCode() < 300;
        } catch (Exception e) {
            return false;
        }
    }

    private static String encode(String val) {
        return URLEncoder.encode(val != null ? val : "", StandardCharsets.UTF_8);
    }
}
