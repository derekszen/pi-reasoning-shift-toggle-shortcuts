import assert from "node:assert/strict";
import { test } from "node:test";
import type { Model } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import reasoningShiftToggleShortcuts from "../index.ts";

type Level = ReturnType<ExtensionAPI["getThinkingLevel"]>;
type Shortcut = { description?: string; handler: (ctx: ExtensionContext) => void | Promise<void> };

function model(overrides: Partial<Model<"openai-responses">> = {}): Model<"openai-responses"> {
  return {
    id: "codex-main",
    name: "Test reasoning model",
    provider: "ai-router",
    api: "openai-responses",
    baseUrl: "http://127.0.0.1:9/v1",
    reasoning: true,
    input: ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 128000,
    maxTokens: 4096,
    thinkingLevelMap: { low: "low", medium: "medium", high: "high", xhigh: "xhigh", max: "max" },
    ...overrides,
  };
}

function harness(initial: Level = "high", selectedModel: Model<"openai-responses"> | undefined = model()) {
  let level = initial;
  const changes: Level[] = [];
  const notifications: Array<{ text: string; type: string }> = [];
  const shortcuts = new Map<string, Shortcut>();
  const pi = {
    getThinkingLevel: () => level,
    setThinkingLevel: (next: Level) => { level = next; changes.push(next); },
    registerShortcut: (key: string, shortcut: Shortcut) => shortcuts.set(key, shortcut),
  } as unknown as ExtensionAPI;
  const ctx = {
    mode: "tui",
    hasUI: true,
    model: selectedModel,
    ui: { notify: (text: string, type: string) => notifications.push({ text, type }) },
  } as unknown as ExtensionContext;
  reasoningShiftToggleShortcuts(pi);
  return {
    ctx, changes, notifications, shortcuts,
    level: () => level,
    press: async (key: "shift+up" | "shift+down") => {
      const shortcut = shortcuts.get(key);
      assert.ok(shortcut);
      await shortcut.handler(ctx);
    },
  };
}

test("registers exactly the directional shortcuts; leaves Shift+Tab alone", () => {
  const h = harness();
  assert.deepEqual([...h.shortcuts.keys()], ["shift+up", "shift+down"]);
});

test("increases one supported level and clamps without wrapping", async () => {
  const h = harness();
  await h.press("shift+up");
  assert.equal(h.level(), "xhigh");
  await h.press("shift+up");
  assert.equal(h.level(), "max");
  await h.press("shift+up");
  assert.equal(h.level(), "max");
  assert.deepEqual(h.changes, ["xhigh", "max"]);
  assert.match(h.notifications.at(-1)!.text, /maximum/);
});

test("decreases one supported level and stops at the minimum", async () => {
  const h = harness();
  for (const expected of ["medium", "low", "minimal", "off"] as const) {
    await h.press("shift+down");
    assert.equal(h.level(), expected);
  }
  await h.press("shift+down");
  assert.deepEqual(h.changes, ["medium", "low", "minimal", "off"]);
  assert.match(h.notifications.at(-1)!.text, /minimum/);
});

test("skips unsupported levels according to Pi model metadata", async () => {
  const h = harness("high", model({ thinkingLevelMap: { off: null, minimal: null, low: "low", medium: null, high: "high", xhigh: null, max: null } }));
  await h.press("shift+down");
  assert.equal(h.level(), "low");
  await h.press("shift+down");
  assert.equal(h.level(), "low");
  await h.press("shift+up");
  assert.equal(h.level(), "high");
  await h.press("shift+up");
  assert.deepEqual(h.changes, ["low", "high"]);
});

test("does not assume xhigh/max support when mappings are absent", async () => {
  const h = harness("high", model({ thinkingLevelMap: undefined }));
  await h.press("shift+up");
  assert.equal(h.level(), "high");
  assert.deepEqual(h.changes, []);
});

test("accepts routed Codex aliases, profile prefixes, and direct Codex providers", async () => {
  for (const [provider, id] of [
    ["ai-router", "codex-main"],
    ["ai-router", "codex-2/codex-main"],
    ["ai-router", "codex-fast"],
    ["ai-router", "codex-luna"],
    ["openai-codex", "gpt-5.3-codex"],
    ["openai-codex", "some-future-codex-model"],
    ["another-provider", "another-reasoning-model"],
  ]) {
    const h = harness("high", model({ provider, id }));
    const original = h.ctx.model;
    await h.press("shift+down");
    assert.equal(h.level(), "medium");
    assert.equal(h.ctx.model, original);
    assert.equal(h.ctx.model?.id, id);
    assert.equal(h.ctx.model?.provider, provider);
  }
});

test("instances have independent effort and no shared mutable state", async () => {
  const first = harness("high");
  const second = harness("low");
  await first.press("shift+up");
  assert.equal(first.level(), "xhigh");
  assert.equal(second.level(), "low");
  await second.press("shift+up");
  assert.equal(second.level(), "medium");
  assert.equal(first.level(), "xhigh");
});

test("uses the currently selected model after a model switch", async () => {
  const h = harness();
  h.ctx.model = model({ id: "restricted-model", thinkingLevelMap: { medium: null, xhigh: null, max: null } });
  await h.press("shift+down");
  assert.equal(h.level(), "low");
  assert.equal(h.ctx.model.id, "restricted-model");
});

test("non-reasoning and missing models warn without mutating effort", async () => {
  for (const selectedModel of [model({ reasoning: false }), undefined]) {
    const h = harness();
    h.ctx.model = selectedModel;
    await h.press("shift+up");
    await h.press("shift+down");
    assert.deepEqual(h.changes, []);
    assert.equal(h.notifications[0]?.type, "warning");
    assert.match(h.notifications[0]!.text, /does not support/);
  }
});

test("unsupported current effort warns rather than guessing or changing it", async () => {
  const h = harness("max", model({ thinkingLevelMap: undefined }));
  await h.press("shift+up");
  await h.press("shift+down");
  assert.equal(h.level(), "max");
  assert.deepEqual(h.changes, []);
  assert.match(h.notifications[0]!.text, /Use \/thinking/);
});

test("headless modes and unavailable UI do not notify or mutate state", async () => {
  for (const mode of ["rpc", "json", "text"] as const) {
    const h = harness();
    Object.assign(h.ctx, { mode });
    await h.press("shift+up");
    assert.deepEqual(h.changes, []);
    assert.deepEqual(h.notifications, []);
  }
  const h = harness();
  h.ctx.hasUI = false;
  await h.press("shift+down");
  assert.deepEqual(h.changes, []);
  assert.deepEqual(h.notifications, []);
});

test("notifications describe the next-request semantics", async () => {
  const h = harness();
  await h.press("shift+down");
  assert.match(h.notifications[0]!.text, /Reasoning: medium .*next model request/);
});
