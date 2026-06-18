import os
from dotenv import load_dotenv
from google.genai import types

load_dotenv()

# FIX #45: Remove hardcoded Vertex project ID
PROJECT_ID = os.getenv("VERTEX_PROJECT_ID")
if not PROJECT_ID:
    raise ValueError("VERTEX_PROJECT_ID environment variable is missing. Cannot start Sentinel.")
REGION = os.getenv("VERTEX_REGION", "us-central1")
MODEL = "gemini-live-2.5-flash-native-audio"

# Vision Settings
VISION_INTERVAL = 2.0  # seconds between screen captures
VISION_MIN_DIFF = 50.0 # minimum MSE difference to trigger an upload

from pathlib import Path

# FIX #44: Fix typo in instruction path ("Instrctions" -> "Sentinel/Instructions")
instruction_path = Path(__file__).parent / "Sentinel" / "Instructions" / "sentinel.md"
try:
    with open(instruction_path, "r", encoding="utf-8") as f:
        SENTINEL_SYSTEM_INSTRUCTION = f.read()
except FileNotFoundError:
    SENTINEL_SYSTEM_INSTRUCTION = "You are SENTINEL"

import platform

def get_os() -> str:
    return platform.system()

def is_windows() -> bool:
    return get_os() == "Windows"

def is_mac() -> bool:
    return get_os() == "Darwin"

def is_linux() -> bool:
    return get_os() == "Linux"

SENTINEL_PROMPT = types.Content(
    role="system",
    parts=[types.Part.from_text(text=SENTINEL_SYSTEM_INSTRUCTION)]
)

# Trigger reload
