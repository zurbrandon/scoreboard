# Showboard PRD v1

## Vision
Showboard is a desktop application designed specifically for live comedy shows.

Its purpose is to replace the current PowerPoint-based scoreboard workflow with software that feels more like a professional sports broadcast while dramatically simplifying the job of the sound technician.

The application should make score reveals feel exciting, reduce mistakes during shows, and eliminate the constant switching between PowerPoint slides.

Although Showboard may eventually become part of the larger Blitz Box project, Version 1 should be treated as a standalone application.

## Primary Goal
During a live show, the sound technician should be able to operate the entire scoreboard with five physical buttons or the on-screen controls while requiring almost no interaction with the mouse.

The audience should only ever see polished, animated presentation screens.

## Non-Goals (Version 1)
The following are intentionally out of scope.

- Lighting control
- Soundboard integration
- General music player
- Video playback
- Generic PowerPoint replacement
- Game slide editor
- Networked multiplayer
- Internet connectivity
- Cloud sync
- Accounts or authentication

These may become future projects but should not influence Version 1 architecture beyond keeping future expansion possible.

## Target Platform
Primary deployment target:

- Windows 10

Primary development environment:

- macOS

The application should be built so approximately 90% of development can occur on macOS. Windows-specific functionality should be isolated wherever possible.

## Technology Stack
**Frontend**

- React
- TypeScript
- Vite

**Desktop**

- Electron

Electron is chosen because it provides:

- Multiple native windows
- Display management
- Local filesystem access
- Audio playback
- Global keyboard shortcuts (future)
- HID / USB integration (future)
- Cross-platform behavior

## Core Product Philosophy
Showboard has exactly one responsibility:

> Display the correct thing on the projector while making score reveals exciting.

Everything else is secondary.

## Application Architecture
The application consists of two windows.

### Operator Window
Visible only to the technician. Contains:

- Current live score
- Pending score
- Team names
- Score controls
- Reveal controls
- Display mode controls
- Music status
- Settings

### Projector Window
Visible only to the audience. Displays exactly one scene at a time. Possible scenes:

- Scoreboard
- ComedySportz logo
- Seattle Comedy Theater logo
- Comic
- Slideshow
- Black screen

The projector window should never expose controls.

## Score Model
The application maintains two versions of the score.

**Live Score** — currently visible to the audience. Example: Blue 12 / Red 10.

**Pending Score** — visible only to the technician. Example: Blue 14 / Red 11.

Score changes only affect Pending. The audience should never see score changes until Reveal is pressed.

## Reveal
Reveal is the central interaction of the application. When Reveal is pressed:

1. Pending score becomes Live score.
2. Random bumper music begins.
3. Winning team is automatically determined.
4. Appropriate animation plays.
5. Reveal button returns to idle.

The Reveal button should feel like a game show buzzer or sports broadcast control. It should be visually emphasized in the interface and eventually become the largest physical button on the controller.

## Scoring Controls
Minimum controls: Blue -, Blue +, Red -, Red +, Reveal.

The operator interface may expose additional controls.

## Display Modes
The operator can instantly switch the projector to: Scoreboard, ComedySportz Logo, Seattle Comedy Theater Logo, Comic, Slideshow, Black Screen.

Switching should be immediate. No transitions are required for Version 1.

## Scoreboard Layout
Initial layout should be fixed. Components include:

- Background
- Blue team panel
- Red team panel
- Blue team name
- Red team name
- Blue score
- Red score
- League / theater logo

Future versions may allow freeform editing.

## Reveal Animation
The reveal sequence should feel premium but remain relatively subtle. Suggested sequence:

1. Start bumper music.
2. Animate score counting upward or downward.
3. Slightly enlarge the winning team's score panel.
4. Trigger a small particle or confetti effect.
5. Return to resting state.

Entire sequence: approximately 1 to 2 seconds.

## Winner Detection
The application should automatically determine: Blue leading, Red leading, Tie. Different animation states may be used for each. The operator should never manually choose the winner.

## Music
Reveal should randomly choose a bumper track. Requirements:

- Local MP3 folder
- Random selection
- Avoid immediately repeating previous track
- Adjustable volume
- Optional Reveal without music

Future versions may support categorized bumper libraries.

## Scene Persistence
Application should remember: team names, last score, last selected display, music folder, volume, theme, window positions. Store locally. No cloud functionality.

## Keyboard Shortcuts
Version 1: application-level shortcuts only. Future: global shortcuts. Future: physical controller. The underlying command system should be identical regardless of input source.

## Command Architecture
Every interaction should be represented by a command. Examples: `blue.increment`, `blue.decrement`, `red.increment`, `red.decrement`, `score.reveal`, `display.scoreboard`, `display.logo`, `display.black`.

The operator UI, keyboard shortcuts, and future hardware controller should all dispatch these same commands. Business logic should never depend on where the command originated.

## Future Hardware
Version 1 should be designed with a dedicated controller in mind. Initial controller: Blue -, Blue +, Red -, Red +, Reveal.

Eventually additional buttons may include: Logo, Black, Slideshow, Comic, Next Slide, Previous Slide, Music Controls.

The application should not assume a keyboard is the only input device.

## UI Principles
Large controls. Minimal text. Easy to operate in a dark theater. Primary interactions should be obvious from several feet away. Every action should have visible feedback. Avoid unnecessary dialogs. Avoid nested menus during live operation.

## MVP Milestones
**Milestone 1 — Browser prototype:** Operator route, Projector route, Shared state, Pending vs Live score.

**Milestone 2 — Animations:** Reveal, Winner detection, Confetti.

**Milestone 3 — Audio:** Random bumper playback, Reveal synchronization.

**Milestone 4 — Electron:** Two native windows, Fullscreen projector, Settings persistence.

**Milestone 5 — Windows validation:** Display detection, Fullscreen behavior, Projector handling, Audio routing, Keyboard shortcuts.

## Stretch Goals
Layout editor, Sponsor overlays, Timers, Lower thirds, Player introductions, Game overlays, Audience prompts, Scene editor, Custom themes, Animated logos, Physical controller support.

## Success Criteria
A sound technician with no training should be able to:

- Launch the application.
- Choose the projector display.
- Enter team names.
- Run an entire ComedySportz show without touching PowerPoint.
- Reveal every score with a single button.
- Never accidentally expose controls to the audience.

If the application accomplishes this reliably, Version 1 is a success.
