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

def is_binary_file(filepath: Path) -> bool:
    """Detects if a file is binary by checking the first 1024 bytes for null characters."""
    try:
        TEXT_EXTENSIONS = {
            '.txt', '.md', '.py', '.json', '.xml', '.yaml', '.yml', '.ini', '.cfg', '.conf',
            '.log', '.csv', '.tsv', '.html', '.css', '.js', '.ts', '.jsx', '.tsx', '.sh', '.bat', '.ps1'
        }
        if filepath.suffix.lower() in TEXT_EXTENSIONS:
            return False

        with open(filepath, 'rb') as f:
            chunk = f.read(1024)
            # Check for UTF-16 BOMs first
            if chunk.startswith(b'\xff\xfe') or chunk.startswith(b'\xfe\xff'):
                return False
            return b'\x00' in chunk
    except Exception:
        return False

def read_file(path: str) -> str:
    """Reads the contents of a specific file. Limited to 800 lines. Supports PDFs, DOCX, and fallback encodings. Returns JSON string."""
    target_path = _secure_path(path)
    if not target_path:
        return json.dumps({"error": f"Restricted path: {path}"})
    if not target_path.exists():
        return json.dumps({"error": f"File does not exist at exactly '{path}'. You must provide the full relative path from the workspace root. Run get_file_tree() or search_code() to find the correct path."})
    if not target_path.is_file():
        return json.dumps({"error": f"Path is a directory, use list_directory instead: {path}"})
        
    logger.info(f"Reading file: {target_path}")

    # Handle PDF files
    if target_path.suffix.lower() == '.pdf':
        try:
            import pypdf
            reader = pypdf.PdfReader(target_path)
            text_parts = []
            total_chars = 0
            for page_num, page in enumerate(reader.pages):
                page_text = page.extract_text() or ""
                text_parts.append(f"--- Page {page_num + 1} ---\n{page_text}")
                total_chars += len(page_text)
                if total_chars > 50000:
                    text_parts.append("\n... [TRUNCATED DUE TO SIZE LIMIT] ...")
                    break
            return json.dumps({
                "path": str(target_path.as_posix()),
                "content": "\n".join(text_parts)
            })
        except ImportError:
            return json.dumps({"error": "This is a PDF file. To enable PDF text extraction, please run 'pip install pypdf' in the backend environment."})
        except Exception as pdf_err:
            return json.dumps({"error": f"Error parsing PDF file: {pdf_err}"})

    # Handle DOCX files
    if target_path.suffix.lower() == '.docx':
        try:
            import docx
            doc = docx.Document(target_path)
            text_parts = []
            for p in doc.paragraphs:
                text_parts.append(p.text)
            return json.dumps({
                "path": str(target_path.as_posix()),
                "content": "\n".join(text_parts)
            })
        except ImportError:
            return json.dumps({"error": "This is a DOCX file. To enable DOCX text extraction, please run 'pip install python-docx' in the backend environment."})
        except Exception as docx_err:
            return json.dumps({"error": f"Error parsing DOCX file: {docx_err}"})

    # Filter other binary files
    if is_binary_file(target_path):
        return json.dumps({"error": f"File is binary and cannot be read as text: {path}. Use open_externally to open it."})

    try:
        content = ""
        # Try decoding with different encodings
        encodings_to_try = ['utf-8', 'utf-16', 'latin-1']
        
        decoded = False
        for encoding in encodings_to_try:
            try:
                with open(target_path, 'r', encoding=encoding) as f:
                    lines = []
                    for i, line in enumerate(f):
                        if i >= 800:
                            lines.append(f"\n... [TRUNCATED AT 800 LINES] Use search_code for deeper inspection ...")
                            break
                        lines.append(line)
                    content = "".join(lines)
                    decoded = True
                    break
            except (UnicodeDecodeError, LookupError):
                continue
                
        if not decoded:
            raise Exception("Unable to decode file with UTF-8, UTF-16, or Latin-1.")

        return json.dumps({
            "path": str(target_path.as_posix()),
            "content": content
        })
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

def open_externally(path_or_url: str = None, path: str = None) -> str:
    """
    Opens a file, directory, web URL, application, or system settings pane using 
    the system's default handler (equivalent to double-clicking on Windows).
    """
    target = path_or_url or path
    if not target:
        return json.dumps({"error": "No path or URL provided."})
        
    logger.info(f"Opening resource externally: {target}")
    try:
        # Check for web URLs or system protocol URIs
        if target.startswith(("http://", "https://", "mailto:", "ms-settings:", "ms-calculator:")):
            os.startfile(target)
            return json.dumps({"status": "success", "message": f"Successfully launched URL/URI: {target}"})
            
        # Resolve target local path
        target_path = _secure_path(target)
        if not target_path:
            return json.dumps({"error": f"Invalid or restricted path: {target}"})
            
        if not target_path.exists():
            # If path doesn't exist locally, try launching it directly as a system command (e.g. notepad, calc)
            try:
                os.startfile(target)
                return json.dumps({"status": "success", "message": f"Successfully launched system command: {target}"})
            except Exception as cmd_err:
                return json.dumps({"error": f"Resource not found: {target}. (Launch error: {cmd_err})"})
                
        # Open local file/folder using standard handler
        os.startfile(str(target_path))
        return json.dumps({"status": "success", "message": f"Successfully opened: {target_path}"})
    except Exception as e:
        logger.error(f"Error opening resource {target}: {e}")
        return json.dumps({"error": f"Failed to open resource: {e}"})

# Backward compatibility alias
open_resource = open_externally

def open_internally(path: str) -> str:
    """
    Inspects a file (reads its content) or a directory (lists its files and subdirectories) internally.
    """
    target_path = _secure_path(path)
    if not target_path:
        return json.dumps({"error": f"Restricted path: {path}"})
    if not target_path.exists():
        return json.dumps({"error": f"Path does not exist: {path}"})
        
    if target_path.is_file():
        return read_file(path)
    elif target_path.is_dir():
        return list_directory(path)
    else:
        return json.dumps({"error": f"Unknown path type: {path}"})


