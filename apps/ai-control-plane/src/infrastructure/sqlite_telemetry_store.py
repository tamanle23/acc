"""Persistent SQLite (WAL Mode) Telemetry, Run Ledger, A/B Arena Benchmark Scorecard & Fine-Tuning Dataset Exporter (Studio v26)."""

from __future__ import annotations

import csv
import io
import json
import sqlite3
import threading
import time
from collections import OrderedDict
from pathlib import Path
from typing import Any


class SqliteTelemetryStore:
    """Zero-external-dependency SQLite3 WAL-mode store for multi-modal inference runs, DAG pipelines, and A/B Arena scorecards."""

    def __init__(self, db_path: str | Path | None = None) -> None:
        if db_path is None:
            base_dir = Path("/tmp/ai_cockpit_telemetry_v26")
            base_dir.mkdir(parents=True, exist_ok=True)
            self._db_path = str(base_dir / "studio_telemetry_v26.db")
        else:
            p = Path(db_path)
            p.parent.mkdir(parents=True, exist_ok=True)
            self._db_path = str(p)

        self._lock = threading.RLock()
        self._conn: sqlite3.Connection | None = None
        self._artifact_cache: OrderedDict[str, dict[str, Any]] = OrderedDict()
        self._init_schema()

    @property
    def db_path(self) -> str:
        return self._db_path

    def _connect(self) -> sqlite3.Connection:
        if self._conn is not None:
            try:
                self._conn.execute("SELECT 1;")
                return self._conn
            except sqlite3.Error:
                self._conn = None
        conn = sqlite3.connect(self._db_path, timeout=10.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=NORMAL;")
        conn.execute("PRAGMA busy_timeout=5000;")
        self._conn = conn
        return conn

    def close(self) -> None:
        with self._lock:
            if self._conn is not None:
                try:
                    self._conn.close()
                except Exception:
                    pass
                self._conn = None

    def __del__(self) -> None:
        self.close()

    def _init_schema(self) -> None:
        with self._lock:
            conn = self._connect()
            try:
                conn.executescript(
                    """
                    CREATE TABLE IF NOT EXISTS inference_runs (
                        run_id TEXT PRIMARY KEY,
                        timestamp_epoch REAL NOT NULL,
                        timestamp_iso TEXT NOT NULL,
                        engine_id TEXT NOT NULL,
                        model_id TEXT NOT NULL,
                        pipeline_category TEXT NOT NULL,
                        pipeline_type TEXT NOT NULL,
                        modality TEXT NOT NULL,
                        execution_target TEXT NOT NULL,
                        latency_ms REAL NOT NULL,
                        payload_sha256 TEXT NOT NULL,
                        input_summary TEXT NOT NULL,
                        parameters_json TEXT NOT NULL,
                        output_summary_json TEXT NOT NULL,
                        estimated_cost_usd REAL NOT NULL DEFAULT 0.0,
                        tokens_or_units INTEGER NOT NULL DEFAULT 1
                    );

                    CREATE INDEX IF NOT EXISTS idx_runs_ts ON inference_runs(timestamp_epoch DESC);
                    CREATE INDEX IF NOT EXISTS idx_runs_pipeline ON inference_runs(pipeline_type);

                    CREATE TABLE IF NOT EXISTS dag_runs (
                        dag_run_id TEXT PRIMARY KEY,
                        timestamp_epoch REAL NOT NULL,
                        timestamp_iso TEXT NOT NULL,
                        preset_id TEXT NOT NULL,
                        pipeline_name TEXT NOT NULL,
                        node_count INTEGER NOT NULL,
                        total_latency_ms REAL NOT NULL,
                        cache_hits INTEGER NOT NULL DEFAULT 0,
                        final_sha256 TEXT NOT NULL,
                        stages_json TEXT NOT NULL
                    );

                    CREATE INDEX IF NOT EXISTS idx_dag_ts ON dag_runs(timestamp_epoch DESC);

                    CREATE TABLE IF NOT EXISTS arena_comparisons (
                        comparison_id TEXT PRIMARY KEY,
                        timestamp_epoch REAL NOT NULL,
                        timestamp_iso TEXT NOT NULL,
                        left_engine_id TEXT NOT NULL,
                        right_engine_id TEXT NOT NULL,
                        left_latency_ms REAL NOT NULL,
                        right_latency_ms REAL NOT NULL,
                        latency_winner TEXT NOT NULL,
                        speedup_pct REAL NOT NULL,
                        vram_winner TEXT NOT NULL,
                        vram_delta_mb INTEGER NOT NULL,
                        preferred_engine_id TEXT,
                        prompt_snippet TEXT NOT NULL
                    );

                    CREATE INDEX IF NOT EXISTS idx_arena_ts ON arena_comparisons(timestamp_epoch DESC);

                    CREATE TABLE IF NOT EXISTS inference_jobs (
                        job_id TEXT PRIMARY KEY,
                        timestamp_epoch REAL NOT NULL,
                        timestamp_iso TEXT NOT NULL,
                        engine_id TEXT NOT NULL,
                        pipeline_type TEXT NOT NULL,
                        status TEXT NOT NULL,
                        priority INTEGER NOT NULL DEFAULT 1,
                        created_at REAL NOT NULL,
                        started_at REAL,
                        completed_at REAL,
                        latency_ms REAL NOT NULL DEFAULT 0.0,
                        inputs_json TEXT NOT NULL,
                        parameters_json TEXT NOT NULL,
                        progress_json TEXT NOT NULL,
                        result_json TEXT,
                        error_json TEXT,
                        tags_json TEXT NOT NULL DEFAULT '[]'
                    );

                    CREATE INDEX IF NOT EXISTS idx_jobs_ts ON inference_jobs(timestamp_epoch DESC);
                    CREATE INDEX IF NOT EXISTS idx_jobs_status ON inference_jobs(status);
                    CREATE INDEX IF NOT EXISTS idx_jobs_engine ON inference_jobs(engine_id);
                    """
                )
                conn.commit()
            finally:
                pass

    def get_cached_node_artifact(self, cache_key: str) -> dict[str, Any] | None:
        with self._lock:
            found = self._artifact_cache.get(cache_key)
            if found is not None:
                self._artifact_cache.move_to_end(cache_key)
            return found

    def set_cached_node_artifact(self, cache_key: str, artifact: dict[str, Any]) -> None:
        with self._lock:
            if cache_key in self._artifact_cache:
                self._artifact_cache.move_to_end(cache_key)
            self._artifact_cache[cache_key] = artifact
            while len(self._artifact_cache) > 256:
                self._artifact_cache.popitem(last=False)

    def record_inference_run(
        self,
        *,
        run_id: str,
        engine_id: str,
        model_id: str,
        pipeline_category: str,
        pipeline_type: str,
        modality: str,
        execution_target: str,
        latency_ms: float,
        payload_sha256: str,
        inputs: Any,
        parameters: dict[str, Any],
        output_summary: Any,
    ) -> dict[str, Any]:
        now = time.time()
        iso_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))
        input_str = (
            json.dumps(inputs, ensure_ascii=False)[:240]
            if not isinstance(inputs, str)
            else inputs[:240]
        )

        units = max(1, len(input_str.split()))
        cost_usd = round((latency_ms / 1000.0) * 0.00045 + units * 0.000002, 6)

        try:
            out_json = json.dumps(output_summary, ensure_ascii=False, default=str)[:2048]
        except Exception:
            out_json = "{}"

        with self._lock:
            conn = self._connect()
            try:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO inference_runs (
                        run_id, timestamp_epoch, timestamp_iso, engine_id, model_id,
                        pipeline_category, pipeline_type, modality, execution_target,
                        latency_ms, payload_sha256, input_summary, parameters_json,
                        output_summary_json, estimated_cost_usd, tokens_or_units
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        run_id,
                        now,
                        iso_str,
                        engine_id,
                        model_id,
                        pipeline_category,
                        pipeline_type,
                        modality,
                        execution_target,
                        round(float(latency_ms), 2),
                        payload_sha256 or "",
                        input_str,
                        json.dumps(parameters or {}, ensure_ascii=False, default=str),
                        out_json,
                        cost_usd,
                        units,
                    ),
                )
                conn.commit()
            finally:
                pass

        return {
            "run_id": run_id,
            "timestamp_iso": iso_str,
            "engine_id": engine_id,
            "pipeline_type": pipeline_type,
            "latency_ms": round(float(latency_ms), 2),
            "estimated_cost_usd": cost_usd,
        }

    def record_dag_run(
        self,
        *,
        dag_run_id: str,
        preset_id: str,
        pipeline_name: str,
        node_count: int,
        total_latency_ms: float,
        cache_hits: int,
        final_sha256: str,
        stages: list[dict[str, Any]],
    ) -> dict[str, Any]:
        now = time.time()
        iso_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))
        with self._lock:
            conn = self._connect()
            try:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO dag_runs (
                        dag_run_id, timestamp_epoch, timestamp_iso, preset_id,
                        pipeline_name, node_count, total_latency_ms, cache_hits,
                        final_sha256, stages_json
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        dag_run_id,
                        now,
                        iso_str,
                        preset_id,
                        pipeline_name,
                        node_count,
                        round(float(total_latency_ms), 2),
                        cache_hits,
                        final_sha256,
                        json.dumps(stages, ensure_ascii=False, default=str),
                    ),
                )
                conn.commit()
            finally:
                pass

        return {
            "dag_run_id": dag_run_id,
            "timestamp_iso": iso_str,
            "pipeline_name": pipeline_name,
            "total_latency_ms": round(float(total_latency_ms), 2),
        }

    def record_arena_comparison(
        self,
        *,
        comparison_id: str,
        left_engine_id: str,
        right_engine_id: str,
        left_latency_ms: float,
        right_latency_ms: float,
        latency_winner: str,
        speedup_pct: float,
        vram_winner: str,
        vram_delta_mb: int,
        prompt_snippet: str,
        preferred_engine_id: str | None = None,
    ) -> dict[str, Any]:
        now = time.time()
        iso_str = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))
        with self._lock:
            conn = self._connect()
            try:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO arena_comparisons (
                        comparison_id, timestamp_epoch, timestamp_iso,
                        left_engine_id, right_engine_id, left_latency_ms, right_latency_ms,
                        latency_winner, speedup_pct, vram_winner, vram_delta_mb,
                        preferred_engine_id, prompt_snippet
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        comparison_id,
                        now,
                        iso_str,
                        left_engine_id,
                        right_engine_id,
                        round(float(left_latency_ms), 2),
                        round(float(right_latency_ms), 2),
                        latency_winner,
                        round(float(speedup_pct), 1),
                        vram_winner,
                        int(vram_delta_mb),
                        preferred_engine_id,
                        prompt_snippet[:200],
                    ),
                )
                conn.commit()
            finally:
                pass

        return {
            "comparison_id": comparison_id,
            "timestamp_iso": iso_str,
            "latency_winner": latency_winner,
            "speedup_pct": round(float(speedup_pct), 1),
            "vram_winner": vram_winner,
        }

    def vote_arena_preference(
        self, comparison_id: str, preferred_engine_id: str
    ) -> dict[str, Any]:
        with self._lock:
            conn = self._connect()
            try:
                cur = conn.execute(
                    "UPDATE arena_comparisons SET preferred_engine_id = ? WHERE comparison_id = ?",
                    (preferred_engine_id, comparison_id),
                )
                updated = cur.rowcount > 0
                conn.commit()
            finally:
                pass
        return {
            "status": "vote_recorded",
            "comparison_id": comparison_id,
            "preferred_engine_id": preferred_engine_id,
            "updated": updated,
        }

    def get_ledger_snapshot(
        self,
        limit: int = 50,
        pipeline_type: str | None = None,
        engine_id: str | None = None,
    ) -> dict[str, Any]:
        safe_limit = max(1, min(1000, int(limit or 50)))
        with self._lock:
            conn = self._connect()
            try:
                clauses: list[str] = []
                params: list[Any] = []
                if pipeline_type and pipeline_type != "all":
                    clauses.append("pipeline_type = ?")
                    params.append(pipeline_type)
                if engine_id and engine_id != "all":
                    clauses.append("engine_id = ?")
                    params.append(engine_id)
                where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
                cur = conn.execute(
                    f"SELECT * FROM inference_runs {where_sql} ORDER BY timestamp_epoch DESC LIMIT ?",
                    (*params, safe_limit),
                )
                rows = [dict(r) for r in cur.fetchall()]

                dag_cur = conn.execute(
                    "SELECT * FROM dag_runs ORDER BY timestamp_epoch DESC LIMIT 25"
                )
                dag_rows = []
                for dr in dag_cur.fetchall():
                    d = dict(dr)
                    try:
                        d["stages"] = json.loads(d.pop("stages_json", "[]"))
                    except Exception:
                        d["stages"] = []
                    dag_rows.append(d)

                arena_cur = conn.execute(
                    "SELECT * FROM arena_comparisons ORDER BY timestamp_epoch DESC LIMIT 25"
                )
                arena_rows = [dict(ar) for ar in arena_cur.fetchall()]

                all_lat_cur = conn.execute(
                    "SELECT latency_ms, pipeline_type, estimated_cost_usd, tokens_or_units, timestamp_iso FROM inference_runs ORDER BY timestamp_epoch ASC"
                )
                all_records = [dict(r) for r in all_lat_cur.fetchall()]
            finally:
                pass

        latencies = sorted(float(r["latency_ms"]) for r in all_records)
        n = len(latencies)
        if n > 0:
            p50 = latencies[int(0.50 * (n - 1))]
            p95 = latencies[int(0.95 * (n - 1))]
            p99 = latencies[int(0.99 * (n - 1))]
            avg_lat = round(sum(latencies) / n, 2)
        else:
            p50, p95, p99, avg_lat = 0.0, 0.0, 0.0, 0.0

        by_pipeline: dict[str, dict[str, Any]] = {}
        total_cost = 0.0
        total_units = 0
        for r in all_records:
            pt = str(r["pipeline_type"])
            cost = float(r["estimated_cost_usd"])
            units = int(r["tokens_or_units"])
            lat = float(r["latency_ms"])
            total_cost += cost
            total_units += units
            slot = by_pipeline.setdefault(
                pt,
                {
                    "pipeline_type": pt,
                    "runs_count": 0,
                    "total_latency_ms": 0.0,
                    "avg_latency_ms": 0.0,
                    "total_cost_usd": 0.0,
                },
            )
            slot["runs_count"] += 1
            slot["total_latency_ms"] = round(slot["total_latency_ms"] + lat, 2)
            slot["avg_latency_ms"] = round(slot["total_latency_ms"] / slot["runs_count"], 2)
            slot["total_cost_usd"] = round(slot["total_cost_usd"] + cost, 6)

        timeseries = [
            {
                "index": idx + 1,
                "timestamp_iso": r["timestamp_iso"],
                "pipeline_type": r["pipeline_type"],
                "latency_ms": round(float(r["latency_ms"]), 2),
            }
            for idx, r in enumerate(all_records[-24:])
        ]

        return {
            "storage_engine": "sqlite3-wal",
            "db_path": self._db_path,
            "runs": rows,
            "dag_runs": dag_rows,
            "arena_comparisons": arena_rows,
            "arena_runs": arena_rows,
            "metrics_summary": {
                "total_runs": n,
                "total_dag_runs": len(dag_rows),
                "total_arena_runs": len(arena_rows),
                "avg_latency_ms": avg_lat,
                "p50_ms": round(p50, 2),
                "p95_ms": round(p95, 2),
                "p99_ms": round(p99, 2),
                "total_estimated_cost_usd": round(total_cost, 6),
                "total_compute_units": total_units,
                "cached_dag_artifacts": len(self._artifact_cache),
                "by_pipeline_type": list(by_pipeline.values()),
                "latency_timeseries": timeseries,
            },
        }

    def export_dataset(self, fmt: str = "jsonl") -> tuple[str, str]:
        """Export persisted inference runs as JSONL (`application/x-ndjson`) or CSV (`text/csv`)."""
        snap = self.get_ledger_snapshot(limit=500)
        runs = snap["runs"]
        norm_fmt = fmt.lower().strip()

        if norm_fmt == "csv":
            buf = io.StringIO()
            fieldnames = [
                "run_id",
                "timestamp_iso",
                "engine_id",
                "model_id",
                "pipeline_category",
                "pipeline_type",
                "modality",
                "execution_target",
                "latency_ms",
                "payload_sha256",
                "estimated_cost_usd",
                "tokens_or_units",
                "input_summary",
            ]
            writer = csv.DictWriter(buf, fieldnames=fieldnames, extrasaction="ignore")
            writer.writeheader()
            for r in runs:
                writer.writerow(r)
            return buf.getvalue(), "text/csv; charset=utf-8"

        lines = [json.dumps(r, ensure_ascii=False) for r in runs]
        return "\n".join(lines) + ("\n" if lines else ""), "application/x-ndjson"

    # =========================================================================
    # ASYNCHRONOUS INFERENCE JOBS PERSISTENCE & LEDGER (Pattern 2: SSE)
    # =========================================================================

    def record_job_created(
        self,
        *,
        job_id: str,
        engine_id: str,
        pipeline_type: str,
        inputs: Any,
        parameters: dict[str, Any] | None = None,
        priority: int = 1,
        tags: list[str] | None = None,
    ) -> dict[str, Any]:
        """Record new background inference job in QUEUED status."""
        now = time.time()
        iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(now))
        inputs_json = json.dumps(inputs if isinstance(inputs, (dict, list, str, int, float, bool)) else str(inputs), ensure_ascii=False)
        params_json = json.dumps(parameters or {}, ensure_ascii=False)
        init_progress = json.dumps({"step": 0, "total_steps": 1, "percent": 0.0, "stage": "queued"}, ensure_ascii=False)
        tags_json = json.dumps(tags or [], ensure_ascii=False)

        with self._lock:
            conn = self._connect()
            try:
                conn.execute(
                    """
                    INSERT INTO inference_jobs (
                        job_id, timestamp_epoch, timestamp_iso, engine_id, pipeline_type,
                        status, priority, created_at, started_at, completed_at, latency_ms,
                        inputs_json, parameters_json, progress_json, result_json, error_json, tags_json
                    ) VALUES (?, ?, ?, ?, ?, 'queued', ?, ?, NULL, NULL, 0.0, ?, ?, ?, NULL, NULL, ?);
                    """,
                    (job_id, now, iso, engine_id, pipeline_type, priority, now, inputs_json, params_json, init_progress, tags_json),
                )
                conn.commit()
            except sqlite3.Error as exc:
                conn.rollback()
                raise exc

        return {
            "job_id": job_id,
            "status": "queued",
            "created_at": now,
            "engine_id": engine_id,
            "pipeline_type": pipeline_type,
            "priority": priority,
        }

    def update_job_status(
        self,
        job_id: str,
        status: str,
        started_at: float | None = None,
        progress: dict[str, Any] | None = None,
    ) -> None:
        """Update job status and optionally started_at timestamp or progress."""
        with self._lock:
            conn = self._connect()
            try:
                if started_at is not None and progress is not None:
                    conn.execute(
                        "UPDATE inference_jobs SET status = ?, started_at = ?, progress_json = ? WHERE job_id = ?;",
                        (status, started_at, json.dumps(progress, ensure_ascii=False), job_id),
                    )
                elif started_at is not None:
                    conn.execute(
                        "UPDATE inference_jobs SET status = ?, started_at = ? WHERE job_id = ?;",
                        (status, started_at, job_id),
                    )
                elif progress is not None:
                    conn.execute(
                        "UPDATE inference_jobs SET status = ?, progress_json = ? WHERE job_id = ?;",
                        (status, json.dumps(progress, ensure_ascii=False), job_id),
                    )
                else:
                    conn.execute(
                        "UPDATE inference_jobs SET status = ? WHERE job_id = ?;",
                        (status, job_id),
                    )
                conn.commit()
            except sqlite3.Error:
                conn.rollback()

    def update_job_progress(self, job_id: str, progress: dict[str, Any]) -> None:
        """Update job progress payload."""
        with self._lock:
            conn = self._connect()
            try:
                conn.execute(
                    "UPDATE inference_jobs SET progress_json = ? WHERE job_id = ?;",
                    (json.dumps(progress, ensure_ascii=False), job_id),
                )
                conn.commit()
            except sqlite3.Error:
                conn.rollback()

    def record_job_completed(
        self,
        job_id: str,
        result: Any,
        latency_ms: float,
        completed_at: float | None = None,
    ) -> None:
        """Record successful job completion."""
        c_at = completed_at or time.time()
        res_json = json.dumps(result if isinstance(result, (dict, list, str, int, float, bool)) else str(result), ensure_ascii=False)
        final_prog = json.dumps({"step": 1, "total_steps": 1, "percent": 100.0, "stage": "completed"}, ensure_ascii=False)
        with self._lock:
            conn = self._connect()
            try:
                conn.execute(
                    """
                    UPDATE inference_jobs
                    SET status = 'completed', completed_at = ?, latency_ms = ?, result_json = ?, progress_json = ?
                    WHERE job_id = ?;
                    """,
                    (c_at, float(latency_ms), res_json, final_prog, job_id),
                )
                conn.commit()
            except sqlite3.Error:
                conn.rollback()

    def record_job_failed(
        self,
        job_id: str,
        error: dict[str, Any] | str,
        latency_ms: float = 0.0,
        completed_at: float | None = None,
    ) -> None:
        """Record job failure."""
        c_at = completed_at or time.time()
        err_json = json.dumps(error if isinstance(error, dict) else {"message": str(error)}, ensure_ascii=False)
        with self._lock:
            conn = self._connect()
            try:
                conn.execute(
                    """
                    UPDATE inference_jobs
                    SET status = 'failed', completed_at = ?, latency_ms = ?, error_json = ?
                    WHERE job_id = ?;
                    """,
                    (c_at, float(latency_ms), err_json, job_id),
                )
                conn.commit()
            except sqlite3.Error:
                conn.rollback()

    def record_job_cancelled(
        self,
        job_id: str,
        reason: str = "Client requested cancellation",
        completed_at: float | None = None,
    ) -> None:
        """Record job cancellation."""
        c_at = completed_at or time.time()
        err_json = json.dumps({"cancelled": True, "reason": reason}, ensure_ascii=False)
        with self._lock:
            conn = self._connect()
            try:
                conn.execute(
                    """
                    UPDATE inference_jobs
                    SET status = 'cancelled', completed_at = ?, error_json = ?
                    WHERE job_id = ?;
                    """,
                    (c_at, err_json, job_id),
                )
                conn.commit()
            except sqlite3.Error:
                conn.rollback()

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        """Retrieve full details of an inference job by ID."""
        with self._lock:
            conn = self._connect()
            row = conn.execute(
                """
                SELECT job_id, timestamp_epoch, timestamp_iso, engine_id, pipeline_type,
                       status, priority, created_at, started_at, completed_at, latency_ms,
                       inputs_json, parameters_json, progress_json, result_json, error_json, tags_json
                FROM inference_jobs
                WHERE job_id = ?;
                """,
                (job_id,),
            ).fetchone()
            if not row:
                return None
            return self._row_to_job_dict(row)

    def list_jobs(
        self,
        *,
        status: str | None = None,
        engine_id: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        """List recent jobs with optional status/engine filters."""
        query = """
            SELECT job_id, timestamp_epoch, timestamp_iso, engine_id, pipeline_type,
                   status, priority, created_at, started_at, completed_at, latency_ms,
                   inputs_json, parameters_json, progress_json, result_json, error_json, tags_json
            FROM inference_jobs
        """
        clauses = []
        params: list[Any] = []
        if status:
            clauses.append("status = ?")
            params.append(status.lower().strip())
        if engine_id:
            clauses.append("engine_id = ?")
            params.append(engine_id.strip())
        if clauses:
            query += " WHERE " + " AND ".join(clauses)
        query += " ORDER BY created_at DESC LIMIT ?;"
        params.append(max(1, min(int(limit), 200)))

        with self._lock:
            conn = self._connect()
            rows = conn.execute(query, params).fetchall()
            return [self._row_to_job_dict(r) for r in rows]

    def reconcile_stale_jobs(self) -> int:
        """Mark any unfinished jobs from a crashed session as failed."""
        now = time.time()
        err_json = json.dumps({"message": "Process terminated before job completion"}, ensure_ascii=False)
        with self._lock:
            conn = self._connect()
            try:
                cur = conn.execute(
                    """
                    UPDATE inference_jobs
                    SET status = 'failed', completed_at = ?, error_json = ?
                    WHERE status IN ('queued', 'running');
                    """,
                    (now, err_json),
                )
                updated = cur.rowcount
                conn.commit()
                return updated
            except sqlite3.Error:
                conn.rollback()
                return 0

    def _row_to_job_dict(self, row: sqlite3.Row) -> dict[str, Any]:
        def _parse(val: str | None) -> Any:
            if not val:
                return None
            try:
                return json.loads(val)
            except Exception:
                return val

        return {
            "job_id": row["job_id"],
            "timestamp_epoch": row["timestamp_epoch"],
            "timestamp_iso": row["timestamp_iso"],
            "engine_id": row["engine_id"],
            "pipeline_type": row["pipeline_type"],
            "status": row["status"],
            "priority": row["priority"],
            "created_at": row["created_at"],
            "started_at": row["started_at"],
            "completed_at": row["completed_at"],
            "latency_ms": row["latency_ms"],
            "inputs": _parse(row["inputs_json"]),
            "parameters": _parse(row["parameters_json"]),
            "progress": _parse(row["progress_json"]) or {"percent": 0.0},
            "result": _parse(row["result_json"]),
            "error": _parse(row["error_json"]),
            "tags": _parse(row["tags_json"]) or [],
        }

    def clear_ledger(self) -> dict[str, Any]:
        with self._lock:
            conn = self._connect()
            try:
                conn.execute("DELETE FROM inference_runs;")
                conn.execute("DELETE FROM dag_runs;")
                conn.execute("DELETE FROM arena_comparisons;")
                conn.execute("DELETE FROM inference_jobs;")
                conn.commit()
            finally:
                pass
            self._artifact_cache.clear()
        return {"status": "cleared", "storage_engine": "sqlite3-wal"}
