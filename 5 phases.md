Phase 1 — Auto Start
Phase 2 — Memory Loading
Phase 3 — World Model
Phase 4 — Periodic Scanning
Phase 5 — Watchdog
Phase 1 — Auto Start

Goal:

Enter Windows Password
↓
Sentinel Starts

Deliverable:

start_sentinel.bat
Windows Startup
Backend launches
Frontend launches

Success Criteria:

No terminal commands required.
Phase 2 — Memory Loading

Goal:

Sentinel remembers who it is
and who Nisarg is

Startup Flow:

Launch
↓
Load Memory DB
↓
Build Context
↓
Ready

Success Criteria:

Memory available immediately after startup.
Phase 3 — World Model V1

Goal:

Sentinel knows its environment.

Track:

Downloads
Desktop
Documents
Projects

Store:

Files
Folders
Projects

Success Criteria:

"Where is websocket.py?"
"What PDFs do I have?"

can be answered.

Phase 4 — Periodic Scan

Goal:

Sentinel notices changes.

Every:

3 Hours

Run:

Scan
Compare
Update Memory

Example:

New file downloaded
File deleted
Project modified

Success Criteria:

Sentinel can tell what changed since last scan.
Phase 5 — Watchdog

Goal:

Realtime Awareness

Instead of waiting 3 hours:

File Created
↓
Memory Updated Immediately

Success Criteria:

World model updates in real time.