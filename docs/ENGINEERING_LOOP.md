# Qwen implementation loop

OpenSpot JP uses Ollama `qwen3.5:4b` as an external implementation worker. It is not a native Codex subagent and has no direct filesystem authority. Codex prepares a narrow task, Qwen generates code, Codex reviews and applies the accepted output, then tests it and returns exact failures for repair.

Task packets must include the goal, permitted files, existing interfaces, acceptance criteria, and prohibited behavior. Generated output must be machine-readable JSON or a unified diff. Temporary prompts and responses belong in `.qwen-work/` and are not committed.

The loop stops only when relevant tests pass and review finds no critical or high-severity issue. After three malformed outputs for the same task, Codex records the limitation and performs the minimum integration repair needed to continue.
