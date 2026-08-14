# OpenSpot JP agent rules

## Responsibilities

- The primary Codex agent owns requirements, architecture, task decomposition, integration, final review, deployment, and user communication.
- Do not use local Qwen/Ollama models for code generation, editing, or review.
- Use Codex subagents for concrete, independent tasks when parallel work is useful. Keep one owner per file to prevent overlapping edits.
- The primary agent reviews every subagent result before integration and remains responsible for correctness and scope.

## Role and model routing

- Architecture, difficult debugging, security, and final review: `gpt-5.6-sol` with high or xhigh reasoning.
- Android/Kotlin/Compose/MapLibre implementation: `gpt-5.6-terra` with high reasoning; escalate difficult framework or lifecycle bugs to `gpt-5.6-sol`.
- Cloudflare Worker/TypeScript/API implementation: `gpt-5.6-terra` with high reasoning; use `gpt-5.6-sol` for data contracts, caching, reliability, or privacy-sensitive changes.
- Tests, static analysis, documentation checks, and bounded repository inspection: `gpt-5.6-luna` with medium reasoning.
- Prefer the inherited primary model when a model override would not materially improve speed, cost, or correctness.
- If a routed model is unavailable, use the nearest available Codex model and report the fallback; never fall back to Qwen/Ollama.

## Engineering loop

1. The primary agent inspects the current code, identifies risks, and defines acceptance criteria.
2. Delegate only bounded tasks with explicit file ownership, constraints, and expected verification.
3. Run independent Android, Worker, and verification tasks in parallel when their files do not overlap.
4. The primary agent reviews diffs for invented APIs, security/privacy regressions, source-license compliance, and unrelated changes.
5. Run the smallest relevant checks, then the full affected-platform verification before deployment.
6. The primary agent performs deployment, device installation, smoke testing, version control, and final reporting.

Each subagent must return its findings or diff, checks performed, and unresolved risks.

Never send secrets, signing keys, precise user-location logs, or unrelated private files to any subagent. Never request or store background location.

## Verification

- Android: `./gradlew testDebugUnitTest lintDebug assembleDebug`
- Worker: `npm --prefix worker test` and `npm --prefix worker run typecheck`
- Release work must update `CHANGELOG.md`, `versionName`, `versionCode`, and the matching `vX.Y.Z` tag.
