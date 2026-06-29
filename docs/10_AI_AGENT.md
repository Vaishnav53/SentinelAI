# 10 — AI Agent


## Purpose
Provide a private local cybersecurity assistant using Ollama.

## Required sections
- Header with model selector and Ollama state
- AI hero/shield visual
- Start Agent interaction
- Chat panel
- Streaming response
- Quick prompts
- Thinking state
- Voice-ready controls
- Error and reconnect state

## Models
Discover installed models dynamically. Support `llama3.1` and `gemma` immediately.

## Safety
The assistant focuses on explanation, defensive analysis, remediation and authorized lab guidance. Refuse destructive or unauthorized activity.

## Acceptance
Model selection persists during the session, chat streams smoothly, Ollama offline state is friendly, and other pages remain unchanged.


## Architecture rule

Create the page folder only when this module is implemented. Keep page-specific components, hooks, services, utilities and assets inside that folder. Shared primitives remain in the shared component library.

## Testing

- Rendering test
- Loading state
- Empty state
- Error state
- API success
- API failure
- Critical interaction
- Responsive desktop layout
