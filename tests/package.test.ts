import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const root = new URL("../", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
const readme = readFileSync(new URL("README.md", root), "utf8");
const source = readFileSync(new URL("index.ts", root), "utf8");
const name = "pi-reasoning-shift-toggle-shortcuts";
const release = "0.2.0";
const repository = `https://github.com/derekszen/${name}`;
const installSource = `git:github.com/derekszen/${name}@v${release}`;

test("uses the requested model-neutral package name and release", () => {
  assert.equal(manifest.name, name);
  assert.equal(manifest.version, release);
  assert.equal(manifest.homepage, `${repository}#readme`);
  assert.equal(manifest.repository.url, `git+${repository}.git`);
  assert.equal(manifest.bugs.url, `${repository}/issues`);
});

test("documents install/remove commands for the same renamed release", () => {
  assert.ok(readme.startsWith(`# ${name}\n`));
  assert.ok(readme.includes(`pi install ${installSource}`));
  assert.ok(readme.includes(`pi remove ${installSource}`));
  assert.doesNotMatch(readme, /pi-codex-reasoning-shortcuts@v0\.1\.0/);
});

test("keeps the lockfile workspace identity aligned with the package", () => {
  const lock = readFileSync(new URL("bun.lock", root), "utf8");
  assert.ok(lock.includes(`"name": "${manifest.name}"`));
});

test("declares exactly one existing extension entrypoint", () => {
  assert.deepEqual(manifest.pi.extensions, ["./index.ts"]);
  assert.ok(source.includes("export default function"));
});

test("keeps Pi host modules as peers rather than runtime dependencies", () => {
  for (const host of ["@earendil-works/pi-ai", "@earendil-works/pi-coding-agent"]) {
    assert.equal(manifest.peerDependencies[host], "*");
    assert.equal(manifest.dependencies?.[host], undefined);
  }
  assert.deepEqual(manifest.files, ["index.ts", "README.md", "LICENSE", "CHANGELOG.md"]);
});

test("contains no session/provider whitelist or extra effort persistence", () => {
  assert.doesNotMatch(source, /TARGET_SESSION_ID|PI_SESSION_ID|getSessionId|codex-main|ai-router/);
  assert.doesNotMatch(source, /registerTool|registerProvider|setModel|appendEntry|writeFile/);
});

test("documents per-session state and avoids changing default effort", () => {
  assert.match(readme, /only its own active session/);
  assert.match(readme, /global default effort/);
  assert.match(readme, /next model request/);
});
