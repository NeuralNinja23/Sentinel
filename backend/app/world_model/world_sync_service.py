"""
🔄 World Sync Service — Phase 4

Periodically triggers dry-run filesystem scans, diffs folders and files
against the previous snapshot, updates the SQLite memory graph surgically,
and logs change events under the `world_events` anchor node.
"""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.config import DATABASE_PATH
from app.memory.graph import GraphMemoryStore, BRANCH_WORLD
from app.world_model.world_model_service import (
    WorldModelService,
    SNAPSHOT_PATH,
    WORLD_MODEL_ANCHOR_ID,
)

logger = logging.getLogger("world_sync")

WORLD_EVENTS_ANCHOR_ID = "world_events"


class WorldSyncService:
    """Detects modifications, creations, and deletions in the world model

    and synchronises the GraphMemoryStore accordingly.
    """

    _paused = False

    @classmethod
    def pause(cls):
        cls._paused = True
        logger.info("[WORLD SYNC] Periodic scanning scheduler paused.")

    @classmethod
    def resume(cls):
        cls._paused = False
        logger.info("[WORLD SYNC] Periodic scanning scheduler resumed.")

    @classmethod
    def is_paused(cls):
        return cls._paused

    def __init__(self, store: Optional[GraphMemoryStore] = None) -> None:
        self.store = store or GraphMemoryStore(DATABASE_PATH)


    def sync(self) -> dict:
        """Runs the diff-based sync cycle.

        Loads the previous snapshot, runs a dry-run scan, computes diffs
        for folders and files, updates the database, creates memory events,
        and saves the new snapshot.
        """
        start_time = time.time()
        logger.info("[WORLD SYNC] Starting periodic sync scan...")

        # 1. Load previous snapshot if it exists
        old_snapshot = self._load_snapshot()

        # 2. Trigger dry-run scan to get new snapshot
        model_service = WorldModelService(self.store)
        new_summary = model_service.build_world_model(force_rescan=True, dry_run=True)
        new_snapshot = model_service._snapshot

        # 3. Ensure anchor nodes exist in database
        self._ensure_event_anchor_node()

        # 4. Perform diff and update database
        diff_summary = self._apply_diff(old_snapshot, new_snapshot)

        # 5. Save the new snapshot (since DB is now in sync with it)
        new_snapshot["summary"] = {
            "projects_found": len(new_snapshot["projects"]),
            "folders_found": len(new_snapshot["folders"]),
            "files_found": len(new_snapshot["files"]),
            "scan_locations": new_snapshot["scan_locations"],
            "duration_seconds": round(time.time() - start_time, 2),
        }
        self._save_snapshot(new_snapshot)

        duration = round(time.time() - start_time, 2)
        summary = {
            "files_added": diff_summary["added"],
            "files_deleted": diff_summary["deleted"],
            "files_modified": diff_summary["modified"],
            "duration_seconds": duration,
        }

        logger.info("===================================================")
        logger.info(f"  [WORLD SYNC] Sync complete in {duration}s")
        logger.info(f"     Added:    {summary['files_added']}")
        logger.info(f"     Deleted:  {summary['files_deleted']}")
        logger.info(f"     Modified: {summary['files_modified']}")
        logger.info("===================================================")

        return summary

    # ── Diff Engine ──────────────────────────────────────────────────

    def _apply_diff(self, old: dict, new: dict) -> dict:
        old_files = {f["full_path"]: f for f in old.get("files", [])}
        new_files = {f["full_path"]: f for f in new.get("files", [])}

        old_folders = {f["full_path"]: f for f in old.get("folders", [])}
        new_folders = {f["full_path"]: f for f in new.get("folders", [])}

        old_projects = {f["root_path"]: f for f in old.get("projects", [])}
        new_projects = {f["root_path"]: f for f in new.get("projects", [])}

        # 1. Diff folders (shorter lengths added first, longer lengths deleted first)
        added_folders_paths = sorted(new_folders.keys() - old_folders.keys(), key=len)
        deleted_folders_paths = sorted(
            old_folders.keys() - new_folders.keys(), key=len, reverse=True
        )

        # 2. Diff projects
        added_projects_paths = sorted(new_projects.keys() - old_projects.keys(), key=len)
        deleted_projects_paths = sorted(
            old_projects.keys() - new_projects.keys(), key=len, reverse=True
        )

        # 3. Diff files
        added_files_paths = sorted(new_files.keys() - old_files.keys(), key=len)
        deleted_files_paths = sorted(
            old_files.keys() - new_files.keys(), key=len, reverse=True
        )

        modified_files_paths = []
        for path in new_files.keys() & old_files.keys():
            o_file = old_files[path]
            n_file = new_files[path]
            if (
                o_file.get("sha256") != n_file.get("sha256")
                or o_file.get("size_bytes") != n_file.get("size_bytes")
                or o_file.get("last_modified") != n_file.get("last_modified")
            ):
                modified_files_paths.append(path)

        now_iso = datetime.now(timezone.utc).isoformat()

        # Database creation mappings (path -> db_id)
        folder_db_ids = {}
        project_db_ids = {}

        # First, add folders
        for path in added_folders_paths:
            f = new_folders[path]
            parent_path = str(Path(path).parent)
            parent_id = (
                folder_db_ids.get(parent_path)
                or self._find_node_by_path(parent_path)
                or WORLD_MODEL_ANCHOR_ID
            )

            db_id = self._create_db_folder(f["name"], path, parent_id)
            f["node_id"] = db_id
            folder_db_ids[path] = db_id

        # Add projects
        for path in added_projects_paths:
            p = new_projects[path]
            parent_path = str(Path(path).parent)
            parent_id = (
                folder_db_ids.get(parent_path)
                or self._find_node_by_path(parent_path)
                or WORLD_MODEL_ANCHOR_ID
            )

            db_id = self._create_db_project(p["name"], path, parent_id)
            p["node_id"] = db_id
            project_db_ids[path] = db_id

        # Add files
        for path in added_files_paths:
            f = new_files[path]
            parent_path = str(Path(path).parent)
            parent_id = (
                folder_db_ids.get(parent_path)
                or self._find_node_by_path(parent_path)
                or WORLD_MODEL_ANCHOR_ID
            )

            db_id = self._create_db_file(f, parent_id)
            f["node_id"] = db_id

            # Log event node
            self._create_event_node(
                "FILE_CREATED",
                f["name"],
                path,
                now_iso,
                {
                    "size_bytes": f["size_bytes"],
                    "sha256": f["sha256"],
                    "last_modified": f["last_modified"],
                },
            )

        # Update modified files
        for path in modified_files_paths:
            n_file = new_files[path]
            o_file = old_files[path]
            db_id = o_file.get("node_id") or self._find_node_by_path(path)

            if db_id:
                self._update_db_file(db_id, n_file)
                n_file["node_id"] = db_id

            # Log event node
            self._create_event_node(
                "FILE_MODIFIED",
                n_file["name"],
                path,
                now_iso,
                {
                    "size_bytes": n_file["size_bytes"],
                    "sha256": n_file["sha256"],
                    "last_modified": n_file["last_modified"],
                    "old_size_bytes": o_file.get("size_bytes"),
                    "old_sha256": o_file.get("sha256"),
                },
            )

        # Delete files
        for path in deleted_files_paths:
            o_file = old_files[path]
            db_id = o_file.get("node_id") or self._find_node_by_path(path)
            if db_id:
                self.store.delete_node(db_id)

            # Log event node
            self._create_event_node(
                "FILE_DELETED",
                o_file["name"],
                path,
                now_iso,
                {"size_bytes": o_file.get("size_bytes"), "sha256": o_file.get("sha256")},
            )

        # Delete projects
        for path in deleted_projects_paths:
            o_proj = old_projects[path]
            db_id = o_proj.get("node_id") or self._find_node_by_path(path)
            if db_id:
                self.store.delete_node(db_id)

        # Delete folders
        for path in deleted_folders_paths:
            o_fold = old_folders[path]
            db_id = o_fold.get("node_id") or self._find_node_by_path(path)
            if db_id:
                self.store.delete_node(db_id)

        # Carry forward node_ids of unchanged folders/projects/files
        for path, f in new_files.items():
            if ("node_id" not in f or not f["node_id"]) and path in old_files:
                f["node_id"] = old_files[path].get("node_id")

        for path, f in new_folders.items():
            if ("node_id" not in f or not f["node_id"]) and path in old_folders:
                f["node_id"] = old_folders[path].get("node_id")

        for path, p in new_projects.items():
            if ("node_id" not in p or not p["node_id"]) and path in old_projects:
                p["node_id"] = old_projects[path].get("node_id")

        return {
            "added": len(added_files_paths),
            "deleted": len(deleted_files_paths),
            "modified": len(modified_files_paths),
        }

    # ── Database Operations Helpers ─────────────────────────────────

    def _find_node_by_path(self, path: str) -> Optional[str]:
        with self.store._lock:
            cur = self.store.conn.execute(
                "SELECT id, data FROM memory_nodes WHERE id != 'root'"
            )
            for row in cur.fetchall():
                try:
                    data = json.loads(row["data"])
                    if data.get("full_path") == path or data.get("root_path") == path:
                        return row["id"]
                except Exception:
                    continue
        return None

    def _create_db_folder(self, name: str, full_path: str, parent_id: str) -> str:
        data = json.dumps({
            "type": "folder",
            "name": name,
            "full_path": full_path,
        })
        node = self.store.create_node(
            name=f"folder:{name}",
            description=f"Folder: {name}",
            data=data,
            parent_id=parent_id,
        )
        return node.id

    def _create_db_project(self, name: str, root_path: str, parent_id: str) -> str:
        data = json.dumps({
            "type": "project",
            "name": name,
            "root_path": root_path,
        })
        node = self.store.create_node(
            name=f"project:{name}",
            description=f"Project: {name} at {root_path}",
            data=data,
            parent_id=parent_id,
        )
        return node.id

    def _create_db_file(self, f: dict, parent_id: str) -> str:
        data = json.dumps({
            "type": "file",
            "name": f["name"],
            "full_path": f["full_path"],
            "extension": f["extension"],
            "size_bytes": f["size_bytes"],
            "last_modified": f["last_modified"],
            "sha256": f["sha256"],
        })
        description = f"File: {f['name']} ({f['extension']}, {self._human_size(f['size_bytes'])})"
        node = self.store.create_node(
            name=f"file:{f['name']}",
            description=description,
            data=data,
            parent_id=parent_id,
        )
        return node.id

    def _update_db_file(self, db_id: str, f: dict) -> None:
        data = json.dumps({
            "type": "file",
            "name": f["name"],
            "full_path": f["full_path"],
            "extension": f["extension"],
            "size_bytes": f["size_bytes"],
            "last_modified": f["last_modified"],
            "sha256": f["sha256"],
        })
        description = f"File: {f['name']} ({f['extension']}, {self._human_size(f['size_bytes'])})"
        self.store.update_node(
            db_id,
            data=data,
            description=description,
        )

    # ── Memory Events Helpers ───────────────────────────────────────

    def _ensure_event_anchor_node(self) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self.store._lock:
            self.store.conn.execute(
                """INSERT OR IGNORE INTO memory_nodes
                   (id, name, description, data, parent_id,
                    access_count, last_accessed, created_at, updated_at,
                    data_token_count)
                   VALUES (?, ?, ?, '', ?, 0, ?, ?, ?, 0)""",
                (
                    WORLD_EVENTS_ANCHOR_ID,
                    "World Events",
                    "History of filesystem changes detected on this machine.",
                    BRANCH_WORLD,
                    now,
                    now,
                    now,
                ),
            )
            self.store.conn.commit()

    def _create_event_node(
        self,
        event_type: str,
        filename: str,
        path: str,
        timestamp: str,
        metadata: dict,
    ) -> str:
        if event_type == "FILE_CREATED":
            event_description = f"New file created: {filename}"
        elif event_type == "FILE_DELETED":
            event_description = f"File deleted: {filename}"
        elif event_type == "FILE_MODIFIED":
            event_description = f"File modified: {filename}"
        else:
            event_description = f"{event_type.replace('_', ' ').capitalize()}: {filename}"

        event_data = json.dumps({
            "timestamp": timestamp,
            "event_type": event_type,
            "path": path,
            "metadata": metadata,
        })
        node = self.store.create_node(
            name=f"event:{event_type}:{filename}",
            description=event_description,
            data=event_data,
            parent_id=WORLD_EVENTS_ANCHOR_ID,
        )
        return node.id

    # ── Snapshot Management Helpers ──────────────────────────────────

    def _load_snapshot(self) -> dict:
        try:
            if SNAPSHOT_PATH.exists():
                with open(SNAPSHOT_PATH, "r", encoding="utf-8") as f:
                    return json.load(f)
        except Exception as e:
            logger.warning(f"  [WARN] Could not load previous snapshot: {e}")
        return {"projects": [], "folders": [], "files": []}

    def _save_snapshot(self, snapshot: dict) -> None:
        try:
            SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
            with open(SNAPSHOT_PATH, "w", encoding="utf-8") as f:
                json.dump(snapshot, f, indent=2, ensure_ascii=False)
            logger.info(f"  [SNAPSHOT] Snapshot saved to: {SNAPSHOT_PATH}")
        except Exception as e:
            logger.error(f"  [ERROR] Failed to save snapshot: {e}")

    @staticmethod
    def _human_size(size_bytes: int) -> str:
        for unit in ("B", "KB", "MB", "GB"):
            if size_bytes < 1024:
                return f"{size_bytes:.0f}{unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f}TB"

from app.runtime.runtime_state import runtime_events
runtime_events.on("STANDBY_ENTERED", WorldSyncService.pause)
runtime_events.on("STANDBY_EXITED", WorldSyncService.resume)

