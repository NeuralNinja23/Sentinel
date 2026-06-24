from app.Sentinel.tools.fs_tools import list_directory, read_file, get_file_tree, open_resource, open_externally, open_internally
from app.Sentinel.tools.search import search_code
from app.Sentinel.tools.mapper import explain_architecture, explain_module, find_dependencies
from app.Sentinel.tools.web_search import web_search
from app.Sentinel.tools.memory_tools import remember_fact, search_memory


# Defines whether a tool runs instantly and returns, or gets queued as a background task
TOOL_EXECUTION_MODE = {
    "list_directory": "sync",
    "read_file": "sync",
    "get_file_tree": "sync",
    "search_code": "sync",
    "find_dependencies": "sync",
    "open_resource": "sync",
    "open_externally": "sync",
    "open_internally": "sync",
    "web_search": "sync",
    "remember_fact": "sync",
    "search_memory": "sync",
    "explain_module": "background",
    "explain_architecture": "background"
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
    "open_resource": open_resource,
    "open_externally": open_externally,
    "open_internally": open_internally,
    "web_search": web_search,
    "remember_fact": remember_fact,
    "search_memory": search_memory
}


