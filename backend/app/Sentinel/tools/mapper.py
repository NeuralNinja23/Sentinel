import os
import json
from pathlib import Path
from app.services.logger import get_logger
from app.Sentinel.tools.fs_tools import ROOT_DIR, _secure_path

logger = get_logger("mapper_tools")

def explain_architecture() -> str:
    """
    Returns a high level architecture map of the Sentinel codebase in JSON.
    Use this to understand the broad strokes of the system before diving into specific files.
    """
    logger.info("Generating architecture map...")
    
    arch = {
        "frontend_components": [],
        "backend_services": [],
        "backend_apis": [],
        "configuration_files": []
    }
    
    try:
        # Scan frontend components
        fe_components = ROOT_DIR / "frontend" / "components"
        if fe_components.exists():
            for f in fe_components.iterdir():
                if f.is_file() and f.suffix in ('.tsx', '.ts'):
                    arch["frontend_components"].append(f.name)
                    
        # Scan backend APIs
        be_apis = ROOT_DIR / "backend" / "app" / "api"
        if be_apis.exists():
            for f in be_apis.iterdir():
                if f.is_file() and f.suffix == '.py' and not f.name.startswith('__'):
                    arch["backend_apis"].append(f.name)
                    
        # Scan backend services
        be_services = ROOT_DIR / "backend" / "app" / "services"
        if be_services.exists():
            for d in be_services.iterdir():
                if d.is_file() and d.suffix == '.py' and not d.name.startswith('__'):
                    arch["backend_services"].append(d.name)
                elif d.is_dir() and not d.name.startswith('__'):
                    arch["backend_services"].append(f"{d.name}/ (package)")
                    
        # Config files
        for f in ROOT_DIR.iterdir():
            if f.is_file() and (f.name.endswith('.json') or f.name.endswith('.md') or f.name.endswith('.txt')):
                arch["configuration_files"].append(f.name)
                
        return json.dumps(arch)
    except Exception as e:
        return json.dumps({"error": str(e)})

def explain_module(module_name: str) -> str:
    """
    Looks up a specific module (like 'websocket' or 'vision') and attempts to locate its files
    and extract its primary classes/functions to explain what it does.
    """
    from app.Sentinel.tools.search import search_code
    # Use our internal search tool to find references to this module
    return search_code(module_name, search_type="filename")

def find_dependencies(file_path: str) -> str:
    """
    Parses a specific file and extracts all its imports and dependencies.
    Returns JSON string.
    """
    # FIX #47: Use _secure_path to prevent LFI (path traversal)
    target = _secure_path(file_path)
    if not target:
        return json.dumps({"error": f"Restricted path: {file_path}"})
        
    if not target.exists() or not target.is_file():
        return json.dumps({"error": f"File not found: {file_path}"})
        
    logger.info(f"Extracting dependencies for {target}")
    dependencies = []
    try:
        with open(target, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if target.suffix == '.py':
                    if line.startswith('import ') or line.startswith('from '):
                        dependencies.append(line)
                elif target.suffix in ('.ts', '.tsx', '.js', '.jsx'):
                    if line.startswith('import ') or 'require(' in line:
                        dependencies.append(line)
                        
        return json.dumps({"file": file_path, "dependencies": dependencies})
    except Exception as e:
        return json.dumps({"error": str(e)})
