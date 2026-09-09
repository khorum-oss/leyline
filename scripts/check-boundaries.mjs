#!/usr/bin/env node
/**
 * Dependency boundary check (brief §6, §8).
 *
 * `@leyline/schema`, `@leyline/core`, `@leyline/agent`, `@leyline/dsl`, and
 * `@leyline/vanilla` must reach no UI framework, directly or through another
 * workspace package. CI runs this alongside the lint rule that guards imports,
 * because a manifest can declare a dependency no source file has imported yet.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PACKAGES_DIR = 'packages';
const FRAMEWORK_FREE = new Set([
  '@leyline/schema',
  '@leyline/core',
  '@leyline/dsl',
  '@leyline/agent',
  '@leyline/vanilla',
]);
const FRAMEWORKS = [
  /^react($|\/|-dom)/,
  /^svelte($|\/)/,
  /^@sveltejs\//,
  /^vue($|\/)/,
  /^solid-js($|\/)/,
  /^@types\/react/,
];

/** Only the internal facade may name the statechart engine (AD3). */
const ENGINE_OWNER = '@leyline/core';
const ENGINE_DEPS = [/^xstate($|\/)/, /^@xstate\//];

const manifests = new Map();
for (const dir of readdirSync(PACKAGES_DIR)) {
  const path = join(PACKAGES_DIR, dir, 'package.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  manifests.set(manifest.name, { manifest, path });
}

const failures = [];

function declaredDeps(manifest) {
  return Object.keys({
    ...manifest.dependencies,
    ...manifest.peerDependencies,
    ...manifest.devDependencies,
  });
}

function workspaceDeps(manifest) {
  return Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies }).filter((name) =>
    manifests.has(name),
  );
}

/** Walks workspace dependencies so an indirect framework dependency also fails. */
function reachesFramework(name, seen = new Set()) {
  if (seen.has(name)) return undefined;
  seen.add(name);
  const entry = manifests.get(name);
  if (!entry) return undefined;
  const offender = declaredDeps(entry.manifest).find((dep) => FRAMEWORKS.some((f) => f.test(dep)));
  if (offender) return `${name} → ${offender}`;
  for (const dep of workspaceDeps(entry.manifest)) {
    const nested = reachesFramework(dep, seen);
    if (nested) return `${name} → ${nested}`;
  }
  return undefined;
}

for (const name of FRAMEWORK_FREE) {
  if (!manifests.has(name)) {
    failures.push(`${name} is listed as framework-free but no such package exists.`);
    continue;
  }
  const path = reachesFramework(name);
  if (path) failures.push(`${name} must stay framework-free, but its manifests declare: ${path}`);
}

for (const [name, { manifest }] of manifests) {
  if (name === ENGINE_OWNER) continue;
  const offender = declaredDeps(manifest).find((dep) => ENGINE_DEPS.some((e) => e.test(dep)));
  if (offender) {
    failures.push(
      `${name} declares "${offender}". The statechart engine stays behind the facade in ${ENGINE_OWNER} (AD3).`,
    );
  }
}

if (failures.length > 0) {
  console.error('Dependency boundary check failed:\n');
  for (const failure of failures) console.error(`  • ${failure}`);
  console.error('');
  process.exit(1);
}

console.log(`Dependency boundaries hold across ${manifests.size} packages.`);
