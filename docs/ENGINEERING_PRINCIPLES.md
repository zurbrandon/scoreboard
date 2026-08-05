# Engineering Principles

## Philosophy
Showboard is live production software. Reliability is more important than cleverness. The operator should never have to wonder what state the application is in. Every feature should make running a live show simpler, faster, and safer.

## Core Principles

### Single Responsibility
Showboard has one responsibility: display the correct content on the projector while making score reveals feel exciting. Do not add unrelated features.

### Command Driven Architecture
All user actions should become commands. Examples: `blue.increment`, `blue.decrement`, `red.increment`, `red.decrement`, `score.reveal`, `display.logo`, `display.scoreboard`.

The UI should dispatch commands. The business logic should execute commands. This allows future keyboard shortcuts, hardware controllers, and network APIs to reuse exactly the same code.

### Business Logic Never Lives in React Components
React components should only display state and dispatch commands. Business logic that should NOT live inside components:

- Determining which team is winning
- Random music selection
- Reveal sequencing
- State persistence
- Animation orchestration

Instead, place this logic in dedicated services or modules.

### One Source of Truth
There should only be one application state. Operator window and Projector window both observe the same state. No duplicated state. No synchronization code. No copying values between windows.

### Projector Window Is Read Only
The projector window never modifies state. It only renders. Every state change originates from the Operator window or another input device.

### Pending vs Live Is Sacred
The application always knows the current Live Score and the current Pending Score. Never overwrite Live until Reveal. Never partially reveal scores. Reveal is an atomic action.

### Every Input Is Equal
Whether an action comes from mouse, keyboard, future hardware, touchscreen, or network, the application should process the exact same command. Never special-case an input method.

### Windows Are Views
The Operator window and Projector window are different visualizations of the same application. Neither owns the application state.

### State Is Serializable
At any moment the application should be able to save its entire state to JSON. This makes debugging, persistence, undo, and future networking much easier.

### Avoid Hidden State
The operator should always understand: current display, current score, pending score, whether Reveal is waiting, music status. Never require the operator to remember something mentally.

### Explicit Over Implicit
Avoid "magic." Good: `display.set("scoreboard")`. Bad: `toggle()`. Commands should clearly describe intent.

### Error Handling
The application should fail gracefully. Examples: missing music folder, missing logo, missing slideshow, disconnected monitor, missing audio device, corrupt settings. Whenever possible: display an error, keep running, do not crash.

### Offline First
The application should function with no Internet, no cloud services, no authentication, no external APIs. Everything required to run a show should exist locally.

### Keep Features Independent
Music should not know about animations. Animations should not know about persistence. Persistence should not know about windows. Display management should not know about scoring. Loose coupling keeps the codebase easier to maintain.

### Build for Testability
Every important feature should be testable without a projector, a hardware controller, a second monitor, or Windows. If a feature cannot be tested on a developer's MacBook, reconsider its design.

## Animation Philosophy
Animations should communicate information. Never animate simply because it looks cool. Examples: winning team grows slightly, score counts upward, reveal feels energetic. Animations should be fast, readable, consistent, and interruptible.

## Audio Philosophy
Audio is part of the Reveal experience. Audio should never block the UI. If audio fails: reveal still happens, score still updates, the show continues.

## Performance Goals
Application startup should feel nearly instant. Scene switching should feel immediate. Reveal should begin within a fraction of a second after the operator presses the button. Animations should remain smooth even on older Windows hardware.

## Future Expansion
New features should plug into existing systems instead of replacing them. Examples: future controllers dispatch commands, timers become new scenes, game overlays become scene components. Do not rewrite architecture for new features. Extend it.

## Coding Style
Prefer small modules. Prefer composition over inheritance. Avoid large utility files. Write code that is easy to delete. Favor clarity over abstraction. Avoid premature optimization. Name things descriptively. If a future contributor cannot understand a file in a few minutes, simplify it.

## Definition of Done
A feature is complete when:

- It behaves correctly.
- It handles common error cases.
- It is testable.
- It does not break existing workflows.
- It makes the operator's job easier.
- It is simpler than the solution it replaced.

Not when it merely works.
