# Role-based Codex engineering loop

OpenSpot JP uses Codex subagents for bounded work while the primary agent owns architecture, integration, deployment, and final verification.

## Roles

- Architecture and difficult debugging: `gpt-5.6-sol` with high or xhigh reasoning.
- Android implementation: `gpt-5.6-terra` with high reasoning.
- Worker/API implementation: `gpt-5.6-terra` with high reasoning.
- Routine tests and repository inspection: `gpt-5.6-luna` with medium reasoning.
- Security, privacy, reliability, and final review: `gpt-5.6-sol` with high reasoning.

The primary agent assigns explicit files and acceptance criteria. Independent tasks may run in parallel, but two agents must not edit the same file concurrently. Every result must include checks performed and unresolved risks. The primary agent reviews and integrates all changes.

If the selected model is unavailable, use the nearest available Codex model and record the fallback. Local Qwen/Ollama models are not used.

Never provide subagents with secrets, signing keys, precise user-location logs, background-location data, or unrelated private files.
