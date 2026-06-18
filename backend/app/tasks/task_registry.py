from app.Sentinel.tools.fs_tools import list_directory, read_file, get_file_tree
from app.Sentinel.tools.search import search_code
from app.Sentinel.tools.mapper import explain_architecture, explain_module, find_dependencies
from app.Sentinel.tools.context import analyze_codebase_for_query

# Defines whether a tool runs instantly and returns, or gets queued as a background task
TOOL_EXECUTION_MODE = {
    "list_directory": "sync",
    "read_file": "sync",
    "get_file_tree": "sync",
    "search_code": "sync",
    "find_dependencies": "sync",
    "explain_module": "background",
    "explain_architecture": "background",
    "analyze_codebase_for_query": "background"
}

# The actual synchronous functions mapping
TOOL_REGISTRY = {
    "list_directory": list_directory,
    "read_file": read_file,
    "get_file_tree": get_file_tree,
    "search_code": search_code,
    "explain_architecture": explain_architecture,
    "explain_module": explain_module,
    "find_dependencies": find_dependencies,
    "analyze_codebase_for_query": analyze_codebase_for_query,
}
