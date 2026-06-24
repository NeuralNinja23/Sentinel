import os
import sys
import io
import docx
import asyncio
from fastapi import UploadFile, HTTPException

# Add backend app directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from app.api.upload import (
    upload_document,
    clear_documents,
    delete_document,
    list_documents,
    uploaded_documents,
    get_all_documents_text_context
)

async def test_upload_txt():
    print("\n--- Testing TXT File Upload ---")
    await clear_documents()
    assert len(uploaded_documents) == 0
    
    file_content = "This is a test text document for Sentinel local context."
    file_bytes = file_content.encode("utf-8")
    
    # Construct UploadFile
    upload_file = UploadFile(filename="test_doc.txt", file=io.BytesIO(file_bytes))
    
    res = await upload_document(upload_file)
    assert len(res) == 1
    assert res[0].filename == "test_doc.txt"
    assert len(uploaded_documents) == 1
    assert uploaded_documents[0]["filename"] == "test_doc.txt"
    assert uploaded_documents[0]["content"] == file_content
    print("TXT upload test passed!")

async def test_upload_md():
    print("\n--- Testing MD File Upload ---")
    file_content = "# Sentinel Test\nThis is a markdown test file."
    file_bytes = file_content.encode("utf-8")
    
    upload_file = UploadFile(filename="notes.md", file=io.BytesIO(file_bytes))
    res = await upload_document(upload_file)
    
    assert len(res) == 2
    assert any(doc.filename == "notes.md" for doc in res)
    assert any(doc.filename == "test_doc.txt" for doc in res)
    print("MD upload test passed!")

async def test_upload_docx():
    print("\n--- Testing DOCX File Upload ---")
    doc = docx.Document()
    doc.add_paragraph("Sentinel DOCX text extractor test snippet.")
    docx_buf = io.BytesIO()
    doc.save(docx_buf)
    docx_bytes = docx_buf.getvalue()
    
    upload_file = UploadFile(filename="doc_test.docx", file=io.BytesIO(docx_bytes))
    res = await upload_document(upload_file)
    
    assert len(res) == 3
    assert any(doc.filename == "doc_test.docx" for doc in res)
    docx_doc = next(d for d in uploaded_documents if d["filename"] == "doc_test.docx")
    assert "Sentinel DOCX text extractor" in docx_doc["content"]
    print("DOCX upload test passed!")

async def test_upload_image_rejected():
    print("\n--- Testing Image Rejection ---")
    image_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01..."
    
    # Test PNG rejection
    upload_file = UploadFile(filename="photo.png", file=io.BytesIO(image_bytes))
    try:
        await upload_document(upload_file)
        assert False, "Should have failed with HTTPException for PNG"
    except HTTPException as e:
        assert e.status_code == 400
        assert "Unsupported file format" in e.detail
        
    # Test JPEG rejection
    upload_file = UploadFile(filename="photo.jpeg", file=io.BytesIO(image_bytes))
    try:
        await upload_document(upload_file)
        assert False, "Should have failed with HTTPException for JPEG"
    except HTTPException as e:
        assert e.status_code == 400
        assert "Unsupported file format" in e.detail
        
    print("Image rejection test passed!")

async def test_list_and_delete_and_context():
    print("\n--- Testing List, Delete and Context Injection ---")
    res_list = await list_documents()
    assert len(res_list) == 3
    
    # Check context text
    context = get_all_documents_text_context()
    assert "=== DOCUMENT: test_doc.txt ===" in context
    assert "This is a test text document" in context
    assert "=== DOCUMENT: doc_test.docx ===" in context
    assert "Sentinel DOCX text extractor" in context
    
    # Delete notes.md
    res = await delete_document("notes.md")
    assert len(res) == 2
    assert not any(doc.filename == "notes.md" for doc in res)
    
    # Clear all
    res = await clear_documents()
    assert len(res) == 0
    assert len(uploaded_documents) == 0
    assert get_all_documents_text_context() == ""
    print("List, delete, context and clear tests passed!")

async def main():
    print("Running Sentinel Upload API tests...")
    await test_upload_txt()
    await test_upload_md()
    await test_upload_docx()
    await test_upload_image_rejected()
    await test_list_and_delete_and_context()
    print("\nAll Sentinel Upload API tests PASSED!")

if __name__ == "__main__":
    asyncio.run(main())
