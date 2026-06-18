# Current State of Sentinel

This document provides a comprehensive list of all the files in the Sentinel project and a detailed explanation of their inner workings and specific functions.

## Backend Structure (`/backend/app`)

The backend is a robust Python-based intelligent agent system designed to plan, execute, and remember complex user interactions and tasks.

### Root Files
- **`main.py`**: The main entry point for the backend application. It bootstraps the environment, initializes the API services (like WebSockets), and prepares the core agent to listen for tasks.
- **`config.py`**: Contains global configuration settings, environment variable bindings, and paths necessary for the backend to operate smoothly across different modules.

### Memory System (`/memory`)
The memory system is responsible for making Sentinel context-aware over long periods, acting as the brain's long-term storage.
- **`memory_manager.py`**: This is the core engine for memory extraction and retrieval. It uses an AI model (Gemini 2.5 Flash) to evaluate whether a conversation contains memorable information. If it does, it extracts data into categorized JSON formats. It formats these stored memories into a natural-language prompt context whenever the agent needs to respond to the user, ensuring the AI behaves with historical context. It also has limits and trims older memories when the maximum token size is reached.
- **`long_term.json`**: The actual physical storage file for the agent's memory. It structures data into specific categories:
  - **Identity**: Facts about the user (name, age, birthday, city, job, nationality).
  - **Preferences**: User favorites (food, colors, music, sports, games, hobbies, dislikes).
  - **Projects**: Active tasks or goals the user is working on.
  - **Relationships**: People in the user's life (friends, family, colleagues).
  - **Wishes**: Future plans, things the user wants to buy or travel plans.
  - **Notes**: Any other miscellaneous habits, schedules, or facts worth remembering.
- **`config_manager.py`**: Manages operational settings specifically related to how the memory subsystem behaves and paths where files are stored.

### Agent Core (`/agent`)
This directory contains the central intelligence logic that dictates how Sentinel thinks and acts.
- **`planner.py`**: Acts as the cognitive breakdown module. It takes a high-level user goal (e.g., "research mechanical engineering and save it") and uses Gemini to map out a step-by-step sequential plan. It enforces strict rules, maps steps to available local tools (like `web_search`, `file_controller`), and limits the plan length to maintain efficiency. It also has a replanning capability if steps fail during execution.
- **`executor.py`**: The action runner. It iterates through the plan created by `planner.py` and dynamically invokes the required tools. It injects context between steps (e.g., passing web search results to the file writer), translates text to the user's language, handles executing dynamically generated Python scripts (`generated_code`), and manages step retries or alternative approaches if an error occurs.
- **`error_handler.py`**: A dedicated AI-driven module to analyze why a specific tool or execution step failed. It decides whether to `RETRY` the step, `SKIP` it, `ABORT` the entire task, or generate a fix/alternative plan.
- **`task_queue.py`**: Manages the concurrency and queuing of incoming tasks, ensuring the agent processes requests systematically without conflicting states.

### Actions (`/actions`)
Contains a suite of specific tools that the `planner.py` can invoke to interact with the real world and the local operating system.
- **`browser_control.py`**: Automates web browser navigation, clicking, typing, and scraping data directly from web pages.
- **`code_helper.py`**: Capable of writing, editing, running, and explaining code files on the local filesystem.
- **`computer_control.py`**: Executes low-level OS inputs like simulating keystrokes, mouse clicks, scrolling, and taking screenshots or finding elements on the screen.
- **`computer_settings.py`**: Interfaces with the operating system to toggle system settings.
- **`desktop.py`**: Manages desktop-specific workflows like setting wallpapers, organizing files, or finding specific UI elements.
- **`dev_agent.py`**: specialized features for assisting with advanced software development workflows.
- **`file_controller.py`**: A comprehensive file management tool used to read, write, move, copy, delete, and list files across the system.
- **`file_processor.py`**: Specialized in parsing and processing the contents of files (potentially handling PDFs, docx, or large text blobs).
- **`flight_finder.py`**: Connects to flight databases to query origin, destination, and date parameters.
- **`game_updater.py`**: Interacts with platforms like Steam or Epic Games to check status, install, or update games automatically.
- **`open_app.py`**: Locates and launches local installed applications on the host OS.
- **`reminder.py`**: Interfaces with calendar or local scheduling systems to set time-based alerts.
- **`send_message.py`**: Hooks into messaging platforms (like WhatsApp) to dispatch communications.
- **`weather_report.py`**: Queries weather APIs for specific cities.
- **`web_search.py`**: Connects to search engines to scrape and summarize information for research tasks.
- **`youtube_video.py`**: Controls YouTube playback, searches for videos, or summarizes video content.

### API & Services (`/api` & `/services`)
- **`api/websocket.py`**: Establishes a real-time, bi-directional WebSocket server. This allows the backend to instantly stream logs, state changes, and responses to the frontend UI without polling.
- **`services/gemini.py`**: The central wrapper around the Google Gemini API, handling authentication, model initialization, and standard text generation used by various other modules.
- **`services/logger.py`**: A unified logging utility ensuring all agent actions are recorded for debugging and history tracking.
- **`services/screen.py`**: A utility service dedicated to capturing the computer screen and analyzing its visual contents, acting as the agent's "eyes".

---

## Frontend Structure (`/frontend`)

The frontend is built with React and Next.js, providing a highly visual, futuristic interface for interacting with Sentinel.

### UI and Pages (`/app` & `/components`)
- **`app/page.tsx` & `layout.tsx`**: Define the main routing and structure of the web application. `layout.tsx` wraps the app in necessary providers, while `page.tsx` serves as the entry view.
- **`app/globals.css`**: Global stylesheet defining typography, colors, and potential animations.
- **`components/UIOverlay.tsx`**: Renders the HUD (Heads Up Display) elements. This sits above the visual background and likely includes chat interfaces, status indicators, and tool execution logs.

### Core Visuals and Logic (`/core` & `/systems`)
- **`core/Scene.tsx`**: Sets up the 3D rendering context (likely using Three.js or React Three Fiber) to create a spatial, interactive background.
- **`core/SentinelCore.tsx`**: The main logical wrapper for the frontend experience, connecting state from the WebSocket to the visual representation of the agent.
- **`systems/CosmicNetwork.tsx`**: A specific visual system rendering a highly aesthetic "cosmic network" or node-based particle effect, giving the agent a dynamic, "thinking" visual state.

### Hooks (`/hooks`)
- **`hooks/useVoiceChat.ts`**: Encapsulates the logic for microphone access, voice-to-text transcription, and audio playback, enabling seamless conversational interactions with the backend agent.

---

## Recent Architectural Hardening (The 80-Issue Audit)
Sentinel recently completed a massive Deep Structural Audit spanning 80 critical issues across the entire codebase. This major overhaul stabilized the system by fixing:
- **Concurrency & Responsiveness:** Transitioned from multiprocessing to a `ThreadPoolExecutor` architecture, fragmented blocking sleep loops into 0.1s chunks, and added hard execution timeouts to all synchronous Vertex AI LLM calls and subprocesses.
- **Security & Sandboxing:** Removed command injection vulnerabilities (`shell=True` in `subprocess`), hardened `pip install` with user confirmation prompts, restricted `shutil.rmtree` destructive loops, and sanitized dynamic inputs.
- **Memory & Resource Leaks:** Plugged fatal WebGL VRAM leaks in React Three Fiber by properly disposing geometries/materials, and replaced aggressive `genai.Client` network instantiations with lazily initialized singletons to reduce handshake overhead.
- **Frontend Data Pipelines:** Upgraded the microphone capture from the deprecated `createScriptProcessor` to `AudioWorkletNode`, and replaced bloated Base64 WebSocket text frames with raw binary PCM ArrayBuffers to prevent browser Garbage Collection freezes.
- **Tool Reliability & Grounding:** Integrated `google_search` grounding directly into Vertex AI calls to stop static hallucinations, added robust Google Search fallbacks to brittle YouTube scraping, dynamically mapped Steam drives using `psutil`, and ensured multi-tool workflows are resilient against unexpected UI states.
