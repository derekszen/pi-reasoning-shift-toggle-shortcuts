# Changelog

## 0.2.0

- Rename the package to `pi-reasoning-shift-toggle-shortcuts` to reflect its model-neutral behavior.
- Add test-first coverage for package identity, release links, entrypoint, host-provided dependencies, and per-session state.
- Exercise normal user-level package discovery in the terminal smoke test, including reload and duplicate-shortcut diagnostics.
- Document replacing the standalone session-scoped extension without loading duplicate shortcuts.
- Keep the runtime small and unchanged apart from neutral naming: native Pi state, no extra tools or persistence layer.

## 0.1.0

- Add Shift+Up and Shift+Down to increase/decrease the active Pi session's reasoning effort.
- Use Pi's supported-level metadata and native session APIs, with no model whitelist or session-ID restriction.
- Clamp at the model's supported bounds; preserve the model/provider and startup defaults.
- Include automated tests and an isolated terminal smoke test.
