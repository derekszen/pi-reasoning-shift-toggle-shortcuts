/** Shift+Up / Shift+Down reasoning shortcuts, local to the active Pi session. */
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

export default function reasoningShiftToggleShortcuts(pi: ExtensionAPI): void {
  function step(direction: -1 | 1, ctx: ExtensionContext): void {
    if (ctx.mode !== "tui" || !ctx.hasUI) return;

    if (!ctx.model?.reasoning) {
      ctx.ui.notify("The current model does not support reasoning effort.", "warning");
      return;
    }

    const levels = getSupportedThinkingLevels(ctx.model);
    const current = pi.getThinkingLevel();
    const index = levels.indexOf(current);
    if (index === -1) {
      ctx.ui.notify(
        `Reasoning level ${current} is not supported by the current model. Use /thinking to select a supported level.`,
        "warning",
      );
      return;
    }

    const nextIndex = Math.max(0, Math.min(levels.length - 1, index + direction));
    const next = levels[nextIndex];
    if (next === undefined) return;
    if (next === current) {
      ctx.ui.notify(
        `Reasoning: ${current} (already at the ${direction > 0 ? "maximum" : "minimum"}).`,
        "info",
      );
      return;
    }

    // Use Pi's session API: persistence, clamping, and footer updates stay native.
    // This does not change the model/provider, startup defaults, or in-flight work.
    pi.setThinkingLevel(next);
    ctx.ui.notify(`Reasoning: ${pi.getThinkingLevel()} (applies to the next model request).`, "info");
  }

  pi.registerShortcut("shift+up", {
    description: "Increase reasoning effort for the current session",
    handler: (ctx) => step(1, ctx),
  });
  pi.registerShortcut("shift+down", {
    description: "Decrease reasoning effort for the current session",
    handler: (ctx) => step(-1, ctx),
  });
}
