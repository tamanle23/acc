import sys
import json
import traceback

def respond_success(req_id, data):
    res = {
        "id": req_id,
        "status": "success",
        "data": data
    }
    print(json.dumps(res), flush=True)

def respond_error(req_id, message):
    res = {
        "id": req_id,
        "status": "error",
        "message": str(message)
    }
    print(json.dumps(res), flush=True)

def run_worker(task_handler):
    """
    Main IPC loop for Python workers.
    :param task_handler: A function that takes a dict payload and returns a dict data result.
    """
    print("WORKER_READY", flush=True)
    
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
            
        req_id = None
        try:
            req = json.loads(line)
            req_id = req.get("id")
            action = req.get("action")
            payload = req.get("payload", {})
            
            # Delegate to domain-specific handler
            result_data = task_handler(action, payload)
            
            respond_success(req_id, result_data)
            
        except json.JSONDecodeError:
            print(f"Error parsing JSON: {line}", flush=True)
        except Exception as e:
            trace = traceback.format_exc()
            print(f"Worker Exception: {trace}", flush=True)
            if req_id:
                respond_error(req_id, str(e))
