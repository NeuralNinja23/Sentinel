import json
from app.config import DATABASE_PATH
from app.memory.graph import GraphMemoryStore
from app.memory.graph_ops import find_best_node, merge_node_data
from app.services.logger import get_logger

logger = get_logger("memory_tools")

def remember_fact(fact: str, category: str) -> str:
    """
    Saves a new user fact or standing instruction to persistent memory.
    - fact: The details or rule to remember (e.g. "User boxes at Trenches Gym").
    - category: Must be 'user' (for facts about the user) or 'directives' (for response style/tone/behavior instructions).
    """
    branch_id = category.lower().strip()
    if branch_id not in ('user', 'directives', 'world'):
        return json.dumps({"error": "Category must be 'user', 'directives', or 'world'"})
        
    logger.info(f"Adding memory fact to branch '{branch_id}': {fact}")
    try:
        store = GraphMemoryStore(DATABASE_PATH)
        
        # Traverse memory graph to find best matching node
        node_id = find_best_node(
            store=store,
            fragment=fact,
            ollama_base_url="",  # Ignored by Gemini direct client
            ollama_chat_model="",  # Ignored
            branch_root_id=branch_id
        )
        
        # Fast-path check if node already contains this fact
        if store.node_contains_fact(node_id, fact):
            logger.info("Fact already exists in node memory. Skipping.")
            return json.dumps({"status": "success", "message": "Fact already exists in memory."})
            
        # Merge the fact into the node's data
        merge_result = merge_node_data(
            store=store,
            node_id=node_id,
            new_facts=[fact],
            ollama_base_url="",
            ollama_chat_model=""
        )
        
        if not merge_result.success:
            # Fallback to append if merge failed/was rejected by hallucination guard
            logger.warning(f"Merge failed. Appending fact verbatim to node {node_id}.")
            store.append_to_node(node_id, fact)
            
        store.touch_node(node_id)
        return json.dumps({"status": "success", "message": f"Successfully saved to {category} memory."})
    except Exception as e:
        logger.error(f"Error in remember_fact: {e}")
        return json.dumps({"error": f"Failed to save memory: {str(e)}"})

def search_memory(query: str) -> str:
    """
    Searches the persistent memory graph for facts matching the query.
    - query: Keywords to search for.
    """
    logger.info(f"Searching memory for: {query}")
    try:
        store = GraphMemoryStore(DATABASE_PATH)
        nodes = store.search_nodes(query, limit=5)
        
        results = []
        for node in nodes:
            results.append({
                "node_name": node.name,
                "description": node.description,
                "data": node.data
            })
            
        return json.dumps({"results": results})
    except Exception as e:
        logger.error(f"Error in search_memory: {e}")
        return json.dumps({"error": f"Search failed: {str(e)}"})
