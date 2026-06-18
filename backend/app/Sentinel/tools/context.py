import json
from app.services.logger import get_logger
from app.Sentinel.tools.search import search_code
from app.Sentinel.tools.fs_tools import read_file

logger = get_logger("context_builder")

def analyze_codebase_for_query(query: str) -> str:
    """
    Automated context assembly pipeline. Use this tool when the user asks complex questions
    about the codebase. It automatically searches the codebase, ranks relevant files,
    and returns a condensed package of the most relevant code snippets without blowing up the context window.
    """
    logger.info(f"Building reasoning context for query: {query}")
    
    # 1. Search for text in the codebase
    search_results_json = search_code(query, search_type="text")
    search_data = json.loads(search_results_json)
    
    if "error" in search_data:
        return search_results_json
        
    results = search_data.get("results", [])
    if not results:
        # Fallback to filename search if no content matches
        search_results_json = search_code(query, search_type="filename")
        search_data = json.loads(search_results_json)
        results = search_data.get("results", [])
        
    if not results:
        return json.dumps({"message": f"No relevant code found for query: {query}"})
        
    # 2. Build Context Package
    context_package = []
    
    # Limit to top 3 most relevant files to avoid Vertex AI token explosion
    for res in results[:3]:
        file_path = res.get("path")
        
        # If it was a content search, we already have exact snippets.
        if "matches" in res:
            context_package.append({
                "file": file_path,
                "relevant_snippets": res["matches"],
                "total_matches_in_file": res.get("total_matches", 0)
            })
        else:
            # If it was a filename match, read a preview of the file
            file_data_json = read_file(file_path)
            file_data = json.loads(file_data_json)
            if "content" in file_data:
                # Grab the first 100 lines as a preview
                lines = file_data["content"].split("\n")[:100]
                context_package.append({
                    "file": file_path,
                    "content_preview": "\n".join(lines)
                })
                
    return json.dumps({
        "query": query,
        "context_package": context_package,
        "note": "This is a condensed snippet view to protect the token limit. If you need more details on a specific file, use read_file()."
    })
