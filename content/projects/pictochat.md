+++
title = 'PictoChat (Web)'
date = '2026-11-08T09:00:00-08:00'
tldr = 'A browser port of my terminal PictoChat, in the look of the Nintendo DS original: pick a name, hop into a room, draw and chat.'
layout = 'pictochat'
+++

**Personal Project**, 2026

**Technologies:** JavaScript (ES modules), Canvas API, BroadcastChannel API

A browser version of my terminal PictoChat (a separate project from the Go [Pictochat TUI](../terminal-chat-app/)), dressed in the look of the Nintendo DS original. Pick a name and a color, choose one of four rooms (or make a private one and share its link), then chat with text and hand-drawn sketches. You can type with your keyboard (Enter sends) or use the on-screen one. Press a key on the on-screen keyboard and drag, and the character lifts off and follows your pointer: let go over the message box to place it anywhere, and keep typing from there. It plays the original sound effects too, with a Sound switch under the screen.

- Drawings are stored as strokes (lists of points) instead of images, so they stay small and look sharp at any size. Text you drag into the box is stored the same way, as pieces with a position.
- Sounds are decoded ahead of time and played with the Web Audio API, so even the first click has its sound; the drawing sound gets louder the faster you draw.
- Players are tracked with "presence" events, so room head counts and join/leave bars update live.
- The picture of the keyboard has a real, invisible button laid over every key, and the text box and controls are real form elements, so it also works with a keyboard and a screen reader.

**Trying it with two people:** the site itself is static, so chat goes through a small relay server (`relay/server.js`) that passes each visitor's messages on to the others. It stores nothing. The status line under the screen tells you whether you're connected. If the relay is switched off, chat still works between tabs of the same browser, so you can open this page in a second tab, join the same room, and talk to yourself.

**Credits:** the screen and button pictures and the pixel font and sound effects come from [PictoChat Online](https://github.com/ayunami2000/ayunpictojava) by ayunami2000 (the font is © caveras 2016). The code on this page is my own. PictoChat is a Nintendo trademark, and this page isn't affiliated with or endorsed by Nintendo.
