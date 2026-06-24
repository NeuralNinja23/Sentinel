"""
🐕 Desktop Watchdog Service — Phase 5

Recursive filesystem observer on the Desktop to capture and record events
(creations, deletions, modifications, moves) instantly in the GraphMemoryStore.
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from watchdog.events import FileSystemEvent, FileSystemEventHandler
from watchdog.observers import Observer

from app.config import DATABASE_PATH
from app.memory.graph import GraphMemoryStore, BRANCH_WORLD
from app.world_model.world_sync_service import WORLD_EVENTS_ANCHOR_ID

logger = logging.getLogger("desktop_watchdog")


class DesktopWatchdogHandler(FileSystemEventHandler):
    """Event handler wrapper calling the watchdog service methods."""

    def __init__(self, service: DesktopWatchdogService) -> None:
        self.service = service

    def on_created(self, event: FileSystemEvent) -> None:
        self.service.handle_event("FILE_CREATED", event.src_path, is_directory=event.is_directory)

    def on_deleted(self, event: FileSystemEvent) -> None:
        self.service.handle_event("FILE_DELETED", event.src_path, is_directory=event.is_directory)

    def on_modified(self, event: FileSystemEvent) -> None:
        if event.is_directory:
            return  # Skip directory metadata modifications to avoid noise
        self.service.handle_event("FILE_MODIFIED", event.src_path, is_directory=False)

    def on_moved(self, event: FileSystemEvent) -> None:
        self.service.handle_move_event(
            event.src_path, event.dest_path, is_directory=event.is_directory
        )


class DesktopWatchdogService:
    """Manages the watchdog observer thread watching the Desktop recursively."""

    def __init__(self, store: Optional[GraphMemoryStore] = None) -> None:
        self.store = store or GraphMemoryStore(DATABASE_PATH)
        self.observer: Optional[Observer] = None
        self._recent_events: dict[tuple, float] = {}
        # Watch location: Desktop only
        self.watch_path = Path(os.path.expanduser("~")) / "Desktop"

    def start(self) -> None:
        """Initialize and start the filesystem observer thread."""
        if self.observer is not None:
            return

        logger.info(f"[WATCHDOG] Starting watchdog on: {self.watch_path}")
        self._ensure_event_anchor_node()

        handler = DesktopWatchdogHandler(self)
        self.observer = Observer()
        self.observer.schedule(handler, str(self.watch_path), recursive=True)
        self.observer.start()

    def stop(self) -> None:
        """Stop the filesystem observer and join its thread."""
        if self.observer is not None:
            logger.info("[WATCHDOG] Stopping watchdog observer...")
            self.observer.stop()
            self.observer.join()
            self.observer = None

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

    def _should_ignore(self, path_str: str) -> bool:
        """Returns True if the path contains ignored directories or files."""
        # Ignore this project folder and any subdirectories/files inside it
        try:
            resolved_path = Path(path_str).resolve()
            sentinel_root = Path(__file__).resolve().parents[3]
            if resolved_path == sentinel_root or sentinel_root in resolved_path.parents:
                return True
        except Exception:
            pass

        path = Path(path_str)
        # Check components in path
        for part in path.parts:
            # Skip build/cache and package dependency folders
            if part in {
                ".git",
                "node_modules",
                "venv",
                ".venv",
                "env",
                "Lib",
                "lib",
                "libs",
                "site-packages",
                "dist-packages",
                "__pycache__",
                ".next",
                ".vscode",
                "dist",
                "build",
                ".idea",
                "AppData",
                "$Recycle.Bin",
                "System Volume Information",
                ".env",
                "Backup",
                "Image-Line",
                ".gemini",
            }:
                return True
            # Ignore hidden files/directories except .env
            if part.startswith(".") and part != ".env":
                return True

        # Check file extension
        ext = path.suffix.lower()
        if ext in {".tmp", ".log", ".pyc", ".db", ".db-shm", ".db-wal"}:
            return True

        # Ignore SQLite journal files (ends with -journal) or database names
        if path.name.endswith("-journal") or "Sentinel.db" in path.name:
            return True

        return False

    def handle_event(self, event_type: str, path_str: str, is_directory: bool) -> None:
        """Pre-checks, debounces, and registers an event in the database."""
        if self._should_ignore(path_str):
            return

        now = time.time()
        # Clean expired events (older than 2s) to prevent memory leak
        self._recent_events = {k: t for k, t in self._recent_events.items() if now - t <= 2.0}

        # Debounce key
        key = (event_type, path_str)
        if key in self._recent_events:
            return
        self._recent_events[key] = now

        # Add event to database
        self._log_event_in_db(event_type, path_str, is_directory)

    def handle_move_event(self, src_path: str, dest_path: str, is_directory: bool) -> None:
        """Handles file/folder moves and renames, treating cross-ignore boundaries

        as creation or deletion where appropriate.
        """
        src_ignored = self._should_ignore(src_path)
        dest_ignored = self._should_ignore(dest_path)

        if src_ignored and dest_ignored:
            return

        # If source is ignored but destination isn't -> FILE_CREATED on destination
        if src_ignored and not dest_ignored:
            self.handle_event("FILE_CREATED", dest_path, is_directory)
            return

        # If destination is ignored but source isn't -> FILE_DELETED on source
        if not src_ignored and dest_ignored:
            self.handle_event("FILE_DELETED", src_path, is_directory)
            return

        # Both are not ignored -> FILE_MOVED event
        now = time.time()
        self._recent_events = {k: t for k, t in self._recent_events.items() if now - t <= 2.0}

        key = ("FILE_MOVED", src_path, dest_path)
        if key in self._recent_events:
            return
        self._recent_events[key] = now

        self._log_move_event_in_db(src_path, dest_path, is_directory)

    def _log_event_in_db(self, event_type: str, path_str: str, is_directory: bool) -> None:
        path = Path(path_str)
        filename = path.name
        now_iso = datetime.now(timezone.utc).isoformat()

        if event_type == "FILE_CREATED":
            desc = f"New {'folder' if is_directory else 'file'} created: {filename}"
        elif event_type == "FILE_DELETED":
            desc = f"{'Folder' if is_directory else 'File'} deleted: {filename}"
        elif event_type == "FILE_MODIFIED":
            desc = f"File modified: {filename}"
        else:
            desc = f"{event_type.replace('_', ' ').capitalize()}: {filename}"

        event_data = json.dumps({
            "timestamp": now_iso,
            "event_type": event_type,
            "path": path_str,
        })

        try:
            self.store.create_node(
                name=f"event:{event_type}:{filename}",
                description=desc,
                data=event_data,
                parent_id=WORLD_EVENTS_ANCHOR_ID,
            )
            logger.info(f"[WATCHDOG] Logged {event_type} for {filename} under world_events.")
        except Exception as e:
            logger.error(f"[WATCHDOG] Error writing event to database: {e}")

    def _log_move_event_in_db(
        self, src_path_str: str, dest_path_str: str, is_directory: bool
    ) -> None:
        src_path = Path(src_path_str)
        dest_path = Path(dest_path_str)
        filename = dest_path.name
        now_iso = datetime.now(timezone.utc).isoformat()

        desc = f"{'Folder' if is_directory else 'File'} moved/renamed: {src_path.name} -> {dest_path.name}"

        event_data = json.dumps({
            "timestamp": now_iso,
            "event_type": "FILE_MOVED",
            "source_path": src_path_str,
            "destination_path": dest_path_str,
        })

        try:
            self.store.create_node(
                name=f"event:FILE_MOVED:{filename}",
                description=desc,
                data=event_data,
                parent_id=WORLD_EVENTS_ANCHOR_ID,
            )
            logger.info(f"[WATCHDOG] Logged FILE_MOVED for {filename} under world_events.")
        except Exception as e:
            logger.error(f"[WATCHDOG] Error writing move event to database: {e}")
