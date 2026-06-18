import os
import json
from pathlib import Path
from app.services.logger import get_logger

logger = get_logger("fs_tools")

# Sentinel Root: c:\Users\SENTINEL\Desktop\GenxAI Labz\Senitnel
# fs_tools.py is at Senitnel/backend/app/Sentinel/tools/fs_tools.py
ROOT_DIR = Path(__file__).resolve().parents[4]

def _secure_path(path_str: str) -> Path | None:
    """Resolves the path allowing full system access."""
    try:
        if len(path_str) == 2 and path_str[1] == ':':
            path_str += '\\'
            
        p = Path(path_str)
        if not p.is_absolute():
            p = ROOT_DIR / p
        
        return p.resolve()
    except Exception as e:
        logger.error(f"Path resolution error for {path_str}: {e}")
        return None

def list_directory(path: str = ".") -> str:
    """Lists files and directories in the specified path. Returns JSON string."""
    target_path = _secure_path(path)
    if not target_path:
        return json.dumps({"error": f"Restricted path: {path}"})
    if not target_path.exists():
        return json.dumps({"error": f"Directory does not exist: {path}. Try using get_file_tree() or list_directory('.') to find the correct path."})
    if not target_path.is_dir():
        return json.dumps({"error": f"Path is a file, use read_file instead: {path}"})
        
    logger.info(f"Listing directory: {target_path}")
    items = []
    try:
        for item in target_path.iterdir():
            # Skip hidden folders and heavy dependencies
            if item.name.startswith('.') and item.name not in ('.env', '.gitignore'):
                continue 
            if item.name in ('node_modules', 'venv', '__pycache__'):
                continue
                
            items.append({
                "name": item.name,
                "type": "directory" if item.is_dir() else "file",
                "size": item.stat().st_size if item.is_file() else None,
            })
            if len(items) >= 200:
                items.append({"name": "... [TRUNCATED AT 200 ITEMS] Use search_code instead ...", "type": "warning", "size": None})
                break
        return json.dumps({
            "path": str(target_path.as_posix()), 
            "items": items
        })
    except Exception as e:
        return json.dumps({"error": str(e)})

def read_file(path: str) -> str:
    """Reads the contents of a specific file. Limited to 800 lines. Returns JSON string."""
    target_path = _secure_path(path)
    if not target_path:
        return json.dumps({"error": f"Restricted path: {path}"})
    if not target_path.exists():
        return json.dumps({"error": f"File does not exist at exactly '{path}'. You must provide the full relative path from the workspace root. Run get_file_tree() or search_code() to find the correct path."})
    if not target_path.is_file():
        return json.dumps({"error": f"Path is a directory, use list_directory instead: {path}"})
        
    logger.info(f"Reading file: {target_path}")
    try:
        lines = []
        with open(target_path, 'r', encoding='utf-8') as f:
            for i, line in enumerate(f):
                if i >= 800:
                    lines.append(f"\n... [TRUNCATED AT 800 LINES] Use search_code for deeper inspection ...")
                    break
                lines.append(line)
                
        return json.dumps({
            "path": str(target_path.as_posix()),
            "content": "".join(lines)
        })
    except UnicodeDecodeError:
        return json.dumps({"error": f"File is binary or not UTF-8 encoded: {path}"})
    except Exception as e:
        return json.dumps({"error": str(e)})

def get_file_tree(path: str = None) -> str:
    """Returns the file tree for the given path (defaults to ROOT_DIR). Returns JSON string."""
    search_root = _secure_path(path) if path else ROOT_DIR
    logger.info(f"Generating file tree for {search_root}...")
    tree = []
    
    try:
        for root, dirs, files in os.walk(search_root):
            # Exclude hidden dirs and heavy dependencies
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules', 'venv', '__pycache__')]
            
            rel_root = Path(root).relative_to(search_root).as_posix()
            if rel_root == '.':
                path_prefix = ""
            else:
                path_prefix = f"{rel_root}/"
                
            for f in files:
                if not f.startswith('.') or f in ('.env', '.gitignore'):
                    tree.append(f"{path_prefix}{f}")
                    if len(tree) >= 400:
                        tree.append("... [TRUNCATED AT 400 FILES] Use search_code to find specific files ...")
                        return json.dumps({"tree": tree, "warning": "Directory too large to fully map."})
                        
        return json.dumps({"tree": tree})
    except Exception as e:
        return json.dumps({"error": str(e)})

