# Conductor OSS: Media Handling and Worker Caching Architecture

## 1. Task State Management
In Conductor OSS, workers are strictly stateless. A worker **does not** save its execution state directly to the database. The orchestration flow operates as follows:

*   **Polling:** Workers constantly poll the Conductor Server (via REST or gRPC) for available tasks in their queues.
*   **Execution:** Workers execute the required business logic locally.
*   **Updating:** Once the task completes (or fails), the worker sends an update payload containing the status, output data, and logs back to the Conductor Server.
*   **Persistence:** The Conductor Server receives this update, evaluates the next steps in the workflow graph, and persists the new state to the configured backend database (e.g., PostgreSQL, MySQL, Redis).

This decoupled design keeps workers independent from the storage layer, allowing them to scale horizontally without needing database credentials or schema awareness.

## 2. Handling Large Media (Claim Check Pattern)
Conductor passes JSON payloads between tasks to orchestrate workflows. Attempting to pass raw binary data or massive base64-encoded media files directly through Conductor will bloat the backend database, degrade server performance, and trigger maximum payload size errors.

To handle files efficiently, use the **Claim Check Pattern** (also known as Pass-by-Reference):

1.  **Upload:** A worker completes its media generation or processing and uploads the raw file to external object storage (e.g., AWS S3, Google Cloud Storage, or MinIO).
2.  **Reference:** The worker updates the Conductor server, passing only a lightweight string reference to the file in its JSON output (e.g., `{"video_url": "s3://bucket/vid_123.mp4"}`).
3.  **Download:** The subsequent worker reads the URL from its input parameters, downloads the file directly from storage, and begins its own processing.

## 3. Local Cache Optimization
When consecutive workflow tasks (e.g., "Render Video" followed by "Publish Video") might run on the same application or physical machine, you can implement a local fallback cache to drastically reduce network bandwidth and speed up execution.

### The Workflow
1. Worker A generates the media, saves it to a designated local folder (e.g., `/tmp/workflow-cache/vid_123.mp4`), and asynchronously uploads it to remote storage. It returns both the remote URI and the local cache key to Conductor:
   ```json
   {
     "remote_url": "s3://media-bucket/vid_output_123.mp4",
     "cache_key": "vid_output_123.mp4"
   }
   ```
2. Worker B starts, reads the input parameters, and executes a file system check.
3. **Cache Hit:** If the local file exists, Worker B skips the download and loads the file directly from the local disk.
4. **Cache Miss:** If the file does not exist locally (e.g., Worker B is on a different machine or the file was evicted), Worker B falls back to downloading it from the remote S3 URL.

*Considerations:* Implementing this requires handling disk space exhaustion (e.g., using an LRU eviction policy or background cron job to delete old files) or utilizing shared network volumes (like NFS).

## 4. Worker Prioritization (Affinity Routing via Task Domains)
Conductor OSS uses a competitive polling model, meaning any worker can pick up a task. This inherently breaks the local cache optimization if Worker B is on a different machine than Worker A. To force Conductor to route the next task to the exact same machine that processed the previous task (guaranteeing a cache hit), use **Task Domains**.

### Implementation Steps
1.  **Output the Machine ID:** Worker A's output payload includes the identifier of the machine it ran on.
    ```json
    {
      "status": "COMPLETED",
      "outputData": {
        "video_path": "/tmp/cache/video_123.mp4",
        "rendered_on_node": "mac-studio-01" 
      }
    }
    ```
2.  **Dynamic Domain Configuration:** In the workflow JSON definition, the domain for the subsequent task is set dynamically using JSONPath based on Worker A's output.
    ```json
    {
      "name": "video_pipeline",
      "tasks": [
        {
          "name": "render_video",
          "taskReferenceName": "render_ref",
          "type": "SIMPLE"
        },
        {
          "name": "publish_video",
          "taskReferenceName": "publish_ref",
          "type": "SIMPLE",
          "domain": "${render_ref.output.rendered_on_node}" 
        }
      ]
    }
    ```
3.  **Targeted Polling:** Worker B instances are configured to poll specifically for their own machine's domain. When the task is queued for `mac-studio-01`, other machines ignore it, and the worker on `mac-studio-01` picks it up, successfully hitting the local cache.
4.  **Fault Tolerance (Domain Fallback):** By locking a task to a specific machine, you risk the task stalling if that machine crashes. Mitigate this by configuring workers with domain fallbacks (e.g., polling `mac-studio-01,NO_DOMAIN`). If the task times out in the specific domain, Conductor drops the domain requirement, allowing another machine to pick it up (resulting in a cache miss but ensuring the workflow completes).