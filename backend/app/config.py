import os
from dotenv import load_dotenv
from google.genai import types

load_dotenv()

PROJECT_ID = os.getenv("VERTEX_PROJECT_ID", "gencode-497110")
REGION = os.getenv("VERTEX_REGION", "us-central1")
MODEL = "gemini-live-2.5-flash-native-audio"

from pathlib import Path

# Load instructions from external file
instruction_path = Path(__file__).parent / "Instrctions" / "sentinel.md"
try:
    with open(instruction_path, "r", encoding="utf-8") as f:
        SENTINEL_SYSTEM_INSTRUCTION = f.read()
except FileNotFoundError:
    SENTINEL_SYSTEM_INSTRUCTION = "You are SENTINEL"

SENTINEL_PROMPT = types.Content(
    role="user",
    parts=[types.Part.from_text(text=SENTINEL_SYSTEM_INSTRUCTION)]
)
