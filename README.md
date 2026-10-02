# pi-reasoning-shift-toggle-shortcuts

**Shift+Up / Shift+Down** reasoning-effort controls for the [Pi coding agent](https://pi.dev), using Pi's native per-session state.

| Shortcut | Action |
| --- | --- |
| **Shift+Up** | Increase reasoning effort one supported level |
| **Shift+Down** | Decrease reasoning effort one supported level |

The shortcuts stop at the model's minimum/maximum instead of wrapping. Pi shows the selected level and uses it for the **next model request**. An already-running request is not changed or restarted.

## Install

Published as a GitHub Pi package:

```sh
pi install git:github.com/derekszen/pi-reasoning-shift-toggle-shortcuts@v0.2.0
```

Run `/reload` in an existing Pi session after installing. Newly started interactive sessions load it automatically.

Install just for a project with `--local`:

```sh
pi install --local git:github.com/derekszen/pi-reasoning-shift-toggle-shortcuts@v0.2.0
```

Or try it in one invocation without saving a package declaration:

```sh
pi -e git:github.com/derekszen/pi-reasoning-shift-toggle-shortcuts@v0.2.0
```

Requires Pi's `getSupportedThinkingLevels()` extension API; tested with **Pi 0.99.2**.

Run only one copy of these shortcuts. If replacing a standalone session-scoped extension, move that file out of Pi's extensions directory before reloading. If upgrading the old package name, remove its package declaration before installing this one. GitHub redirects old repository links, but keeping both sources configured can still load duplicate shortcuts.

## Models and scope

- Works with Codex models accessed directly through Pi or through a compatible proxy such as AI Router.
- It uses Pi's model metadata, not a hard-coded model list. Other reasoning-capable Pi models work too.
- Each Pi instance changes **only its own active session**. No session ID is hard-coded, so new, resumed, forked, and spawned interactive Pi sessions can use the same package.
- The model/provider, global default effort, priority/service tier, and other sessions are unchanged.
- Pi records effort changes in its normal session transcript and restores them on resume.
- Non-reasoning models show a warning instead of changing settings.
- These are terminal shortcuts; print, JSON, and RPC modes are unaffected.
- This extends **Pi**, not the standalone Codex CLI.

Supported levels are determined by Pi's selected model. A proxy must allow client-supplied reasoning effort for the upstream request to honor the selection. An alias that forcibly overrides effort cannot be fixed by a keyboard shortcut.

The extension itself makes no network requests, reads no credentials, and adds no model-callable tools or instructions.

## Why an extension instead of keybindings.json?

Pi's native `app.thinking.cycle` action cycles **forward**. You can rebind it:

```json
{
  "app.thinking.cycle": "shift+up"
}
```

But that does not provide a separate reverse action, and forward cycling wraps at the maximum. This package adds directional increase/decrease while using Pi's native session state API. The existing **Shift+Tab** cycle and `/thinking` picker remain available.

If you previously rebound `app.thinking.cycle` to one of these keys, remove that override before loading this package: Pi reserves its own application shortcuts. Your terminal or multiplexer must also forward Shift+Up/Down to Pi. Check `/hotkeys` for active bindings.

## Remove

```sh
pi remove git:github.com/derekszen/pi-reasoning-shift-toggle-shortcuts@v0.2.0
```

Run `/reload` afterward. Removal does not reset the session's selected reasoning level.

## Development

```sh
bun install --ignore-scripts
bun run check
```

A real-terminal smoke test loads the package through Pi's normal user-level discovery, uses isolated config and scratch session files, disables network activity, and makes no model requests:

```sh
PI_BINARY=/path/to/pi uv run --no-project python tests/terminal-smoke.py
```

## Publishing

The GitHub release is installable now. The package is also npm-ready, but **is not yet published to npm**:

```sh
npm login
npm publish --access public
```

`prepublishOnly` runs type checking and automated tests. Runtime Pi libraries are host-provided peer dependencies, not bundled copies.

MIT licensed.
