"""Exercise real Pi keyboard handling without touching live config or calling a model."""
import datetime
import fcntl
import json
import os
from pathlib import Path
import pty
import select
import struct
import subprocess
import tempfile
import termios
import time
import uuid

PI = os.environ.get("PI_BINARY", "pi")
EXTENSION = os.environ.get("PI_EXTENSION", str(Path(__file__).resolve().parents[1]))
UP = b"\x1b[1;2A"
DOWN = b"\x1b[1;2B"


class PiTerminal:
    def __init__(self, root, thinking_map=None, reasoning=True):
        self.root = root
        self.output = b""
        agent = root / "agent"
        agent.mkdir()
        settings = {"defaultProvider": "ai-router", "defaultModel": "codex-main", "defaultThinkingLevel": "high", "packages": []}
        self.settings = agent / "settings.json"
        self.settings.write_text(json.dumps(settings))
        self.original_settings = self.settings.read_bytes()
        model = {
            "id": "codex-main", "name": "Shortcut test model", "reasoning": reasoning,
            "input": ["text"], "contextWindow": 128000, "maxTokens": 4096,
            "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0},
            "thinkingLevelMap": thinking_map or {"low": "low", "medium": "medium", "high": "high", "xhigh": "xhigh", "max": "max"},
        }
        (agent / "models.json").write_text(json.dumps({"providers": {"ai-router": {
            "baseUrl": "http://127.0.0.1:9/v1", "api": "openai-responses", "apiKey": "local-test-only", "models": [model],
        }}}))
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        self.session = root / "scratch-session.jsonl"
        entries = [
            {"type": "session", "version": 3, "id": str(uuid.uuid4()), "timestamp": now, "cwd": str(root)},
            {"type": "model_change", "id": "model001", "parentId": None, "timestamp": now, "provider": "ai-router", "modelId": "codex-main"},
            {"type": "thinking_level_change", "id": "think001", "parentId": "model001", "timestamp": now, "thinkingLevel": "high"},
            {"type": "message", "id": "user0001", "parentId": "think001", "timestamp": now, "message": {"role": "user", "content": "Local shortcut test fixture.", "timestamp": int(time.time() * 1000)}},
            {"type": "message", "id": "assist01", "parentId": "user0001", "timestamp": now, "message": {
                "role": "assistant", "content": [{"type": "text", "text": "Fixture ready."}],
                "api": "openai-responses", "provider": "ai-router", "model": "codex-main",
                "usage": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0, "totalTokens": 0, "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0, "total": 0}},
                "stopReason": "stop", "timestamp": int(time.time() * 1000),
            }},
        ]
        self.session.write_text("".join(json.dumps(entry) + "\n" for entry in entries))
        self.master, slave = pty.openpty()
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 35, 120, 0, 0))
        env = {key: value for key, value in os.environ.items() if not key.startswith("PI_") and key != "HERDR_ENV"}
        env.update({"PI_CODING_AGENT_DIR": str(agent), "PI_OFFLINE": "1", "PI_TELEMETRY": "0", "TERM": "xterm-256color"})
        self.proc = subprocess.Popen([
            PI, "--offline", "--no-extensions", "-e", EXTENSION, "--no-skills", "--no-prompt-templates",
            "--no-themes", "--no-context-files", "--no-approve", "--no-tools", "--session", str(self.session),
        ], cwd=root, env=env, stdin=slave, stdout=slave, stderr=slave, start_new_session=True)
        os.close(slave)
        try:
            self.wait_for(lambda: b"Fixture ready." in self.output, "Pi startup")
            self.pump(0.3)
            assert b"Failed to load extension" not in self.output, self.output.decode(errors="replace")
        except BaseException:
            self.close()
            raise

    def pump(self, duration):
        end = time.monotonic() + duration
        while time.monotonic() < end:
            ready, _, _ = select.select([self.master], [], [], min(0.05, max(0, end - time.monotonic())))
            if ready:
                try:
                    chunk = os.read(self.master, 65536)
                except OSError:
                    break
                if not chunk:
                    break
                self.output += chunk

    def wait_for(self, condition, label, timeout=10):
        end = time.monotonic() + timeout
        while not condition() and time.monotonic() < end:
            if self.proc.poll() is not None:
                break
            self.pump(0.05)
        assert condition(), f"{label} failed: {self.output[-6000:].decode(errors='replace')}"

    def entries(self):
        return [json.loads(line) for line in self.session.read_text().splitlines()]

    def level(self):
        return [entry["thinkingLevel"] for entry in self.entries() if entry["type"] == "thinking_level_change"][-1]

    def press(self, key, expected, unchanged=False):
        before = self.entries()
        os.write(self.master, key)
        if unchanged:
            self.pump(0.3)
            assert self.entries() == before, "Unexpected session mutation"
        else:
            self.wait_for(lambda: self.level() == expected, f"key -> {expected}")
        assert self.level() == expected, (self.level(), expected)
        assert self.settings.read_bytes() == self.original_settings, "Default settings changed"
        models = [entry for entry in self.entries() if entry["type"] == "model_change"]
        assert len(models) == 1 and models[0]["modelId"] == "codex-main", "Model/provider changed"
        assert models[0]["provider"] == "ai-router", "Provider changed"

    def close(self):
        try:
            if self.proc.poll() is None:
                os.write(self.master, b"\x04")
                self.pump(0.3)
            if self.proc.poll() is None:
                self.proc.terminate()
            self.proc.wait(timeout=5)
        finally:
            if self.proc.poll() is None:
                self.proc.kill()
                self.proc.wait()
            os.close(self.master)


def main():
    with tempfile.TemporaryDirectory(prefix="pi-reasoning-smoke-") as tmp:
        base = Path(tmp)

        def case(name, callback, **kwargs):
            root = base / str(uuid.uuid4())
            root.mkdir()
            terminal = PiTerminal(root, **kwargs)
            try:
                callback(terminal)
            finally:
                terminal.close()
            print("PASS:", name)

        def directional(terminal):
            terminal.press(DOWN, "medium")
            terminal.press(UP, "high")
            terminal.press(UP, "xhigh")
            terminal.press(UP, "max")
            terminal.press(UP, "max", unchanged=True)
            for level in ["xhigh", "high", "medium", "low", "minimal", "off"]:
                terminal.press(DOWN, level)
            terminal.press(DOWN, "off", unchanged=True)
            os.write(terminal.master, b"/reload\r")
            terminal.wait_for(lambda: b"Reloaded keybindings" in terminal.output, "reload")
            terminal.press(UP, "minimal")
            assert b"Shortcut handler error" not in terminal.output

        case("directional keys, bounds, persistence, reload, unchanged defaults/model", directional)
        case("another arbitrary session: same shortcuts work without a session restriction", directional)

        def restricted(terminal):
            terminal.press(DOWN, "low")
            terminal.press(DOWN, "low", unchanged=True)
            terminal.press(UP, "high")
            terminal.press(UP, "high", unchanged=True)

        case("model capabilities: skip unsupported levels", restricted, thinking_map={
            "off": None, "minimal": None, "medium": None, "xhigh": None, "max": None, "low": "low", "high": "high",
        })

        def nonreasoning(terminal):
            recorded_level = terminal.level()
            terminal.press(UP, recorded_level, unchanged=True)
            terminal.press(DOWN, recorded_level, unchanged=True)
            assert b"does not support reasoning effort" in terminal.output

        case("non-reasoning model: warning without mutation", nonreasoning, reasoning=False)

    print("Verified real Pi keyboard handling with isolated config/session files; no model requests made.")


if __name__ == "__main__":
    main()
