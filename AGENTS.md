# OpenSpot JP agent rules

## Responsibilities

- Codex owns requirements, architecture, task decomposition, bug investigation, review, and verification.
- Local Ollama model `qwen3.5:4b` owns code generation and code changes by default.
- Codex supplies Qwen with one bounded task, relevant files, constraints, and acceptance tests; reviews the result; applies only reviewed changes; and returns concrete compiler or test failures for another Qwen pass.
- Codex may make mechanical integration fixes when Qwen repeatedly emits malformed output, but must disclose that deviation to the user.

## Engineering loop

1. Inspect current code and define a small acceptance-tested change.
2. Invoke `scripts/invoke-qwen.ps1` with the task packet.
3. Review for invented APIs, security/privacy regressions, source-license compliance, and accidental unrelated edits.
4. Apply the reviewed patch and run the smallest relevant tests.
5. Return failures to Qwen until tests pass and no high-severity review finding remains.

Never send secrets, signing keys, precise user-location logs, or unrelated files to Qwen. Never request or store background location.

## Verification

- Android: `./gradlew testDebugUnitTest lintDebug assembleDebug`
- Worker: `npm --prefix worker test` and `npm --prefix worker run typecheck`
- Release work must update `CHANGELOG.md`, `versionName`, `versionCode`, and the matching `vX.Y.Z` tag.
