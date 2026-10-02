# Changelog

## 0.1.0

- Add Shift+Up and Shift+Down to increase/decrease the active Pi session's reasoning effort.
- Use Pi's supported-level metadata and native session APIs, with no model whitelist or session-ID restriction.
- Clamp at the model's supported bounds; preserve the model/provider and startup defaults.
- Include automated tests and an isolated terminal smoke test.
