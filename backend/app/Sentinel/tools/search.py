import os
import json
import re
from pathlib import Path
from app.services.logger import get_logger
from app.Sentinel.tools.fs_tools import ROOT_DIR

logger = get_logger("search_tools")

def search_code(query: str, search_type: str = "text") -> str:
    """
    Searches the codebase.
    search_type can be: 'text', 'filename', 'class', 'function', 'symbol'
    Returns JSON string with matching files and snippets.
    """
    logger.info(f"Searching codebase for '{query}' (type: {search_type})")
    
    results = []
    
    # Pre-compile regex for AST-like searches
    if search_type == "class":
        # Python: class X, TypeScript: class X
        regex = re.compile(r'class\s+([A-Za-z0-9_]+)\b')
    elif search_type == "function":
        # Python: def X, TypeScript: function X, const X = () =>
        regex = re.compile(r'(?:def|function)\s+([A-Za-z0-9_]+)\b|const\s+([A-Za-z0-9_]+)\s*=\s*(?:async\s*)?\(')
    else:
        # text, symbol, comment
        regex = re.compile(re.escape(query), re.IGNORECASE)
        
    try:
        import time
        start_time = time.time()
        for root, dirs, files in os.walk(ROOT_DIR):
            if time.time() - start_time > 5.0:
                logger.warning("Search timed out after 5 seconds.")
                break
                
            # FIX #46: Ignore massive directories
            dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules', 'venv', '__pycache__', 'dist', 'build', '.next', 'out')]
            
            for f in files:
                # Skip massive generated files or binary files
                if not f.endswith(('.py', '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.html')):
                    continue
                    
                filepath = Path(root) / f
                rel_path = filepath.relative_to(ROOT_DIR).as_posix()
                
                if search_type == "filename":
                    if query.lower() in f.lower():
                        results.append({"path": rel_path})
                    continue
                    
                # Content search
                try:
                    with open(filepath, 'r', encoding='utf-8') as file:
                        lines = file.readlines()
                        
                    file_matches = []
                    for i, line in enumerate(lines):
                        if search_type in ("class", "function"):
                            matches = regex.findall(line)
                            for match in matches:
                                # match could be a tuple depending on regex groups
                                m_str = match[0] if isinstance(match, tuple) and match[0] else match[1] if isinstance(match, tuple) else match
                                if isinstance(m_str, str) and query.lower() in m_str.lower():
                                    file_matches.append({
                                        "line_number": i + 1,
                                        "content": line.strip()
                                    })
                        else:
                            if regex.search(line):
                                file_matches.append({
                                    "line_number": i + 1,
                                    "content": line.strip()
                                })
                                
                    if file_matches:
                        # Cap matches per file to avoid token explosion
                        results.append({
                            "path": rel_path,
                            "matches": file_matches[:10],
                            "total_matches": len(file_matches)
                        })
                except UnicodeDecodeError:
                    continue
                    
        # Cap total results to top 20 files
        return json.dumps({"query": query, "results": results[:20]})
    except Exception as e:
        return json.dumps({"error": str(e)})
