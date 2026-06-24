class MockVectorStore:
    def add_vector(self, *args, **kwargs):
        pass
    def search(self, *args, **kwargs):
        return []

def get_best_vector_store(db_path, dimension):
    """Mock implementation returning a dummy vector store."""
    return MockVectorStore()
