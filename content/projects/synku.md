+++
title = 'Synku'
date = '2026-01-01T10:00:00-07:00'
tldr = 'A peer-to-peer live collaboration CLI tool — share a codebase over LAN with no Git or cloud dependency.'
+++

**Live Collaboration CLI Tool** — Personal Project, 2026

**Technologies:** C, POSIX Sockets, ncurses, kqueue/inotify, Node.js, WebSocket

Built a peer-to-peer collaborative coding tool in C allowing developers to share a live codebase over LAN via a 4-letter room code, with no Git or cloud dependency.

- Engineered a C daemon using kqueue (macOS) and inotify (Linux) for real-time file watching, serializing change events into a custom op protocol streamed over POSIX sockets.
- Designed and implemented an ncurses TUI displaying live file contents, peer cursor positions, and connection status across concurrent sessions.
- Defined a JSON-based op protocol (insert, delete, cursor, sync) enabling conflict-aware patch application across machines; coordinated with a Node.js WebSocket relay handling room management and op broadcast.
