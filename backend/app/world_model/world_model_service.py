"""
🌍 World Model Service — Phase 3

Scans key local directories to build a filesystem-aware knowledge graph.
Persists discovered files, folders, and projects into the GraphMemoryStore
under the `world` branch, and saves a portable JSON snapshot.

The world model is PERSISTENT — it builds once on first run and stays.
Phase 4 will add incremental diff-based updates.
"""

from __future__ import annotations

import fnmatch
import hashlib
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.config import DATABASE_PATH
from app.memory.graph import GraphMemoryStore, BRANCH_WORLD
from app.services.logger import get_logger

logger = get_logger("world_model")


# ── Scan targets ────────────────────────────────────────────────────────

USER_HOME = Path(os.path.expanduser("~"))

SCAN_LOCATIONS: list[Path] = [
    USER_HOME / "Desktop",
]

# ── Ignore list ─────────────────────────────────────────────────────────

IGNORED_DIRS: set[str] = {
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
    ".tox",
    ".mypy_cache",
    ".pytest_cache",
    "egg-info",
    # Cache / data directories that balloon node counts
    ".cache",
    ".gradle",
    ".nuget",
    ".npm",
    ".yarn",
    "coverage",
    ".coverage",
    "htmlcov",
    "target",
    "out",
    "bin",
    "obj",
    "tmp",
    "temp",
    "logs",
    ".turbo",
    ".parcel-cache",
    ".webpack",
    ".angular",
    "__snapshots__",
    ".sass-cache",
    "Backup",
    "Image-Line",
    ".gemini",
}

IGNORED_FILE_PATTERNS: list[str] = [
    "npm-debug.log",
    "yarn-error.log",
    "*.pyc",
    "*.pyd",
    "*.pyo",
    "*$py.class",
    ".env",
    "pip-log.txt",
    "pip-delete-this-directory.txt",
    "*.log",
    "backend.log",
    ".DS_Store",
    "Thumbs.db",
    "commands.md",
    "command.md",
]

# ── Project markers ─────────────────────────────────────────────────────

PROJECT_MARKERS: set[str] = {
    "package.json",
    "requirements.txt",
    "setup.py",
    "pyproject.toml",
    "Cargo.toml",
    "pom.xml",
    "go.mod",
    "Makefile",
}

# .git is a directory marker, handled separately
PROJECT_DIR_MARKERS: set[str] = {".git"}

# ── Stable node IDs ────────────────────────────────────────────────────

WORLD_MODEL_ANCHOR_ID = "world_model"

# ── JSON snapshot path ──────────────────────────────────────────────────

SNAPSHOT_PATH = Path(__file__).resolve().parent.parent / "memory" / "world_snapshot.json"

# ── SHA256 hashing config ───────────────────────────────────────────────

# Max file size to hash (skip large binaries to keep scans fast)
MAX_HASH_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

# ── Scan safety limits ──────────────────────────────────────────────────

# If a directory has more than this many direct children files,
# it's likely a cache/data dump — record the folder but skip its files
MAX_FILES_PER_DIR = 200


# ── WorldModelService ──────────────────────────────────────────────────

class WorldModelService:
    """Scans the local filesystem and persists a world model into the
    Sentinel knowledge graph.

    The world model is PERSISTENT — once built, it stays across restarts.
    Phase 4 will implement incremental scan → diff → update.
    """

    def __init__(self, store: Optional[GraphMemoryStore] = None) -> None:
        self.store = store or GraphMemoryStore(DATABASE_PATH)

        # Counters
        self._projects: int = 0
        self._folders: int = 0
        self._files: int = 0

        # JSON snapshot accumulator
        self._snapshot: dict = {
            "generated_at": "",
            "scan_locations": [],
            "projects": [],
            "folders": [],
            "files": [],
        }

    # ── Public API ──────────────────────────────────────────────────

    def build_world_model(self, force_rescan: bool = False, dry_run: bool = False) -> dict:
        """Run a full filesystem scan and persist to the knowledge graph.

        If the world model anchor node already exists, this is a NO-OP
        and returns the cached summary. The world model is persistent.

        Returns a summary dict with counts and timing.
        """
        # Check if world model already exists (persistent — don't rebuild)
        if not force_rescan and not dry_run:
            existing = self.store.get_node(WORLD_MODEL_ANCHOR_ID)
            if existing is not None:
                logger.info("===================================================")
                logger.info("  [WORLD MODEL] Already built. Skipping scan.")
                logger.info("===================================================")
                # Return cached summary from snapshot if available
                return self._load_cached_summary()

        start = time.time()
        logger.info("===================================================")
        logger.info(f"  [WORLD MODEL] {'Dry-run' if dry_run else 'First-time'} build started")
        logger.info("===================================================")

        # 1. Create the anchor node under `world`
        if not dry_run:
            self._ensure_anchor_node()

        # 2. Deduplicate scan locations
        resolved = self._resolve_scan_paths()

        # 3. Scan each location
        for scan_path in resolved:
            logger.info(f"  [SCAN] Scanning: {scan_path}")
            self._scan_directory(scan_path, parent_node_id=WORLD_MODEL_ANCHOR_ID, dry_run=dry_run)

        duration = round(time.time() - start, 2)

        summary = {
            "projects_found": self._projects,
            "folders_found": self._folders,
            "files_found": self._files,
            "scan_locations": [str(p) for p in resolved],
            "duration_seconds": duration,
        }

        # 4. Save JSON snapshot
        if not dry_run:
            self._save_snapshot(summary)

        logger.info("===================================================")
        logger.info(f"  [WORLD MODEL] Build complete in {duration}s")
        logger.info(f"     Projects: {self._projects}")
        logger.info(f"     Folders:  {self._folders}")
        logger.info(f"     Files:    {self._files}")
        logger.info("===================================================")

        return summary

    # ── Anchor node management ──────────────────────────────────────

    def _ensure_anchor_node(self) -> None:
        """Create the `world_model` anchor node under the `world` branch
        with a stable ID so it's deterministically locatable."""
        now = datetime.now(timezone.utc).isoformat()
        # Direct SQL insert with stable ID (bypassing create_node's UUID)
        with self.store._lock:
            self.store.conn.execute(
                """INSERT OR IGNORE INTO memory_nodes
                   (id, name, description, data, parent_id,
                    access_count, last_accessed, created_at, updated_at,
                    data_token_count)
                   VALUES (?, ?, ?, '', ?, 0, ?, ?, ?, 0)""",
                (
                    WORLD_MODEL_ANCHOR_ID,
                    "World Model",
                    "Local filesystem snapshot — projects, folders, and files "
                    "discovered on this machine.",
                    BRANCH_WORLD,
                    now, now, now,
                ),
            )
            self.store.conn.commit()

    # ── Cached summary ──────────────────────────────────────────────

    def _load_cached_summary(self) -> dict:
        """Load the summary from the existing JSON snapshot file."""
        try:
            if SNAPSHOT_PATH.exists():
                with open(SNAPSHOT_PATH, "r", encoding="utf-8") as f:
                    data = json.load(f)
                summary = data.get("summary", {})
                logger.info(
                    f"     Cached: {summary.get('projects_found', '?')} projects, "
                    f"{summary.get('folders_found', '?')} folders, "
                    f"{summary.get('files_found', '?')} files"
                )
                return summary
        except Exception as e:
            logger.warning(f"  [WARN] Could not read cached snapshot: {e}")

        return {"projects_found": 0, "folders_found": 0, "files_found": 0,
                "scan_locations": [], "duration_seconds": 0, "cached": True}

    # ── Scan paths ──────────────────────────────────────────────────

    def _resolve_scan_paths(self) -> list[Path]:
        """Deduplicate scan locations. Only include paths that exist."""
        seen: list[Path] = []
        for p in SCAN_LOCATIONS:
            resolved = p.resolve()
            if resolved.exists() and resolved not in seen:
                seen.append(resolved)

        self._snapshot["scan_locations"] = [str(p) for p in seen]
        return seen

    # ── Recursive scanning ──────────────────────────────────────────

    def _scan_directory(
        self,
        dir_path: Path,
        parent_node_id: str,
        depth: int = 0,
        max_depth: int = 6,
        _visited: set | None = None,
        dry_run: bool = False,
    ) -> None:
        """Recursively scan a directory and create graph nodes."""
        if depth > max_depth:
            return

        if _visited is None:
            _visited = set()

        try:
            resolved = dir_path.resolve()
        except (OSError, ValueError):
            return

        # Ignore this project folder and any subdirectories
        sentinel_root = Path(__file__).resolve().parents[3]
        if resolved == sentinel_root or sentinel_root in resolved.parents:
            return

        # Cycle guard
        if str(resolved) in _visited:
            return
        _visited.add(str(resolved))

        if not resolved.is_dir():
            return

        # Check if this directory is a project root
        is_project = self._is_project_root(resolved)

        if is_project:
            node_id = self._create_project_node(resolved, parent_node_id, dry_run=dry_run)
            self._projects += 1
        else:
            node_id = self._create_folder_node(resolved, parent_node_id, dry_run=dry_run)
            self._folders += 1

        # Iterate children
        try:
            entries = sorted(resolved.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
        except PermissionError:
            logger.debug(f"  [DENIED] Permission denied: {resolved}")
            return
        except OSError as e:
            logger.debug(f"  [ERROR] OS error scanning {resolved}: {e}")
            return

        # Separate dirs and files
        child_dirs = []
        child_files = []
        for entry in entries:
            if entry.is_dir():
                child_dirs.append(entry)
            elif entry.is_file():
                child_files.append(entry)

        # Safety: skip files if this folder has too many (cache/data dump)
        if len(child_files) > MAX_FILES_PER_DIR:
            logger.info(
                f"    [SKIP] Skipping {len(child_files)} files in {resolved.name}/ "
                f"(exceeds {MAX_FILES_PER_DIR} cap — likely cache/data)"
            )
            child_files = []  # Still scan subdirectories

        # Process subdirectories
        for entry in child_dirs:
            name = entry.name
            if name in IGNORED_DIRS or name.startswith("."):
                continue
            # Check if this sub-path is already a top-level scan target
            entry_resolved = entry.resolve()
            is_top_level_target = any(
                entry_resolved == sl.resolve()
                for sl in SCAN_LOCATIONS
                if sl.resolve() != resolved
            )
            if is_top_level_target:
                continue

            self._scan_directory(
                entry, parent_node_id=node_id,
                depth=depth + 1, max_depth=max_depth,
                _visited=_visited,
                dry_run=dry_run,
            )

        # Process files
        for entry in child_files:
            if self._should_ignore_file(entry):
                continue
            self._create_file_node(entry, node_id, dry_run=dry_run)
            self._files += 1

    # ── Node creation helpers ───────────────────────────────────────

    def _is_project_root(self, dir_path: Path) -> bool:
        """Check if a directory is a project root by looking for marker files."""
        try:
            children = {e.name for e in dir_path.iterdir()}
        except (PermissionError, OSError):
            return False

        if children & PROJECT_MARKERS:
            return True
        if children & PROJECT_DIR_MARKERS:
            return True
        return False

    def _should_ignore_file(self, file_path: Path) -> bool:
        """Check if a file should be ignored based on name patterns."""
        name = file_path.name
        # Match case-insensitively
        name_lower = name.lower()
        for pattern in IGNORED_FILE_PATTERNS:
            if fnmatch.fnmatch(name_lower, pattern.lower()):
                return True
        return False

    def _create_project_node(self, dir_path: Path, parent_node_id: str, dry_run: bool = False) -> str:
        """Create a project node in the graph."""
        name = dir_path.name
        data = json.dumps({
            "type": "project",
            "name": name,
            "root_path": str(dir_path),
        })
        description = f"Project: {name} at {dir_path}"
        if len(description) > 300:
            description = description[:300]

        node_id = f"dry_project_{dir_path.name}"
        if not dry_run:
            node = self.store.create_node(
                name=f"project:{name}",
                description=description,
                data=data,
                parent_id=parent_node_id,
            )
            node_id = node.id

        self._snapshot["projects"].append({
            "name": name,
            "root_path": str(dir_path),
            "node_id": node_id,
        })

        logger.info(f"    [PROJECT] Project: {name}")
        return node_id

    def _create_folder_node(self, dir_path: Path, parent_node_id: str, dry_run: bool = False) -> str:
        """Create a folder node in the graph."""
        name = dir_path.name
        data = json.dumps({
            "type": "folder",
            "name": name,
            "full_path": str(dir_path),
        })
        description = f"Folder: {name}"

        node_id = f"dry_folder_{dir_path.name}"
        if not dry_run:
            node = self.store.create_node(
                name=f"folder:{name}",
                description=description,
                data=data,
                parent_id=parent_node_id,
            )
            node_id = node.id

        self._snapshot["folders"].append({
            "name": name,
            "full_path": str(dir_path),
            "node_id": node_id,
        })

        return node_id

    def _create_file_node(self, file_path: Path, parent_node_id: str, dry_run: bool = False) -> str:
        """Create a file node in the graph with SHA256 hash."""
        name = file_path.name
        ext = file_path.suffix.lower()

        try:
            stat = file_path.stat()
            size = stat.st_size
            modified = datetime.fromtimestamp(
                stat.st_mtime, tz=timezone.utc
            ).isoformat()
        except (OSError, ValueError):
            size = 0
            modified = ""

        # Compute SHA256 hash (skip files over MAX_HASH_SIZE_BYTES)
        file_hash = self._compute_sha256(file_path, size)

        data = json.dumps({
            "type": "file",
            "name": name,
            "full_path": str(file_path),
            "extension": ext,
            "size_bytes": size,
            "last_modified": modified,
            "sha256": file_hash,
        })
        description = f"File: {name} ({ext}, {self._human_size(size)})"
        if len(description) > 300:
            description = description[:300]

        node_id = f"dry_file_{file_path.name}"
        if not dry_run:
            node = self.store.create_node(
                name=f"file:{name}",
                description=description,
                data=data,
                parent_id=parent_node_id,
            )
            node_id = node.id

        self._snapshot["files"].append({
            "name": name,
            "full_path": str(file_path),
            "extension": ext,
            "size_bytes": size,
            "last_modified": modified,
            "sha256": file_hash,
            "node_id": node_id,
        })

        return node_id

    # ── SHA256 hashing ──────────────────────────────────────────────

    @staticmethod
    def _compute_sha256(file_path: Path, size: int) -> str:
        """Compute SHA256 hash of a file. Returns empty string on error
        or if file exceeds MAX_HASH_SIZE_BYTES."""
        if size == 0 or size > MAX_HASH_SIZE_BYTES:
            return ""

        try:
            h = hashlib.sha256()
            with open(file_path, "rb") as f:
                while True:
                    chunk = f.read(8192)
                    if not chunk:
                        break
                    h.update(chunk)
            return h.hexdigest()
        except (OSError, PermissionError):
            return ""

    # ── JSON snapshot ───────────────────────────────────────────────

    def _save_snapshot(self, summary: dict) -> None:
        """Write the full world model to a JSON file."""
        self._snapshot["generated_at"] = datetime.now(timezone.utc).isoformat()
        self._snapshot["summary"] = summary

        try:
            SNAPSHOT_PATH.parent.mkdir(parents=True, exist_ok=True)
            with open(SNAPSHOT_PATH, "w", encoding="utf-8") as f:
                json.dump(self._snapshot, f, indent=2, ensure_ascii=False)
            logger.info(f"  [SNAPSHOT] Snapshot saved to: {SNAPSHOT_PATH}")
        except Exception as e:
            logger.error(f"  [ERROR] Failed to save snapshot: {e}")

    # ── Utilities ───────────────────────────────────────────────────

    @staticmethod
    def _human_size(size_bytes: int) -> str:
        """Convert bytes to human-readable size."""
        for unit in ("B", "KB", "MB", "GB"):
            if size_bytes < 1024:
                return f"{size_bytes:.0f}{unit}"
            size_bytes /= 1024
        return f"{size_bytes:.1f}TB"
