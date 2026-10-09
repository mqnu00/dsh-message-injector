// src/host/index.ts
import z from "@deepseek-ai/schemastery";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
var presetGroupSchema = z.object({
  name: z.string().default(""),
  description: z.string().default(""),
  content: z.array(z.string()).default([]),
  enabled: z.boolean().default(true)
});
var Config = z.object({
  groups: z.array(presetGroupSchema).default([]).volatile(),
  /** 当前选中组名称；空字符串 = 未选中（F3） */
  selected: z.string().default("").volatile()
});
var name = "dsh-message-injector";
function ownEntryId(ctx) {
  const fiber = ctx.fiber;
  const direct = fiber?.entry?.options?.id;
  if (typeof direct === "string" && direct !== "") return direct;
  try {
    const loader = ctx.loader;
    if (!loader || typeof loader.entries !== "function") return void 0;
    let fallback;
    for (const entry of loader.entries()) {
      const id = entry.options?.id;
      if (entry.options?.name !== name || typeof id !== "string" || id === "") continue;
      if (entry.fiber === fiber) return id;
      if (entry.disabled !== true && fallback === void 0) fallback = id;
    }
    return fallback;
  } catch {
    return void 0;
  }
}
function settingsOf(ctx) {
  try {
    return ctx.get("settings");
  } catch {
    return void 0;
  }
}
var LEGACY_SECTION = "message-injector";
var LEGACY_FIELDS = /* @__PURE__ */ new Set(["groups", "selected"]);
async function readLegacySection(home) {
  for (const filename of ["settings.yaml.imported", "settings.yaml"]) {
    let text;
    try {
      text = await readFile(join(home, filename), "utf8");
    } catch {
      continue;
    }
    let document;
    try {
      document = parse(text);
    } catch {
      continue;
    }
    if (typeof document !== "object" || document === null || Array.isArray(document)) continue;
    const section = document[LEGACY_SECTION];
    if (typeof section !== "object" || section === null || Array.isArray(section)) continue;
    const filtered = {};
    for (const [key, value] of Object.entries(section)) {
      if (LEGACY_FIELDS.has(key)) filtered[key] = value;
    }
    if (Object.keys(filtered).length > 0) return filtered;
  }
  return void 0;
}
async function importLegacyConfig(ctx, settings, entryId) {
  try {
    const home = ctx.profileContext?.home;
    if (typeof home !== "string" || home === "") return;
    const row = settings.describe().find((candidate) => candidate.ns === entryId);
    if (row === void 0) return;
    const user = row.user;
    if (user !== null && typeof user === "object" && Object.keys(user).length > 0) return;
    const section = await readLegacySection(home);
    if (section === void 0) return;
    await settings.update(entryId, section);
  } catch {
  }
}
function apply(ctx, config) {
  ctx.inject(["settings"], (sctx) => {
    try {
      sctx.effect(() => {
        const face = settingsOf(sctx);
        const dispose = face?.configure?.({ auto: false }, ctx.fiber);
        return () => {
          dispose?.();
        };
      }, "dsh-message-injector: settings presentation");
    } catch {
    }
    const entryId = ownEntryId(ctx);
    if (entryId === void 0) return;
    const settings = settingsOf(ctx);
    if (settings === void 0) return;
    try {
      const loader = ctx.loader;
      Promise.resolve(loader?.await?.()).then(
        () => importLegacyConfig(ctx, settings, entryId),
        () => importLegacyConfig(ctx, settings, entryId)
      );
    } catch {
      void importLegacyConfig(ctx, settings, entryId);
    }
  });
}
export {
  Config,
  apply,
  name
};
