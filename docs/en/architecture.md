# Architecture

## Frontend + backend

> dsh officially calls the two parts **host half / client half** — in essence they are the **backend / frontend**: the backend runs inside the dsh server process (config schema, validation, persistence), the frontend runs in the browser (button, form, auto-fill). This documentation uses "frontend/backend".

## Directory layout

```
dsh-message-injector/
├── package.json            # plugin identity: dsh.bundle (activation) + dsh.client (frontend) + exports["./client"] + peerDependencies (dsh 0.2.x gate)
├── bundle.patch.yml         # activation patch: insert entry id = dsh-message-injector (= package name = 0.2.0 settings namespace)
├── pnpm-workspace.yaml      # pnpm config: autoInstallPeers=false (peers come from the dsh runtime) + allowBuilds (esbuild)
├── src/                             # split by the official halves: host (backend) / client (frontend)
│   ├── host/
│   │   ├── index.ts            # backend source: Config schema (.volatile()) + custom settings page + legacy import
│   │   └── node-stubs.d.ts     # type stubs: node:fs/promises, node:path (ambient module declarations)
│   ├── shared/
│   │   └── types.ts            # domain types PresetGroup/PresetConfig (shared by both halves; types only)
│   └── client/                 # frontend source (all browser code; built to lib/client.js)
│       ├── index.tsx           # frontend entry (composition root: wiring only)
│       ├── types/              # contract types (ScopeLike/ConfigFormLike/InputLike/RootCtx defensive service types)
│       ├── api/                # data access (skills.ts: skill catalog + 30s TTL cache)
│       ├── services/           # business services (injector.ts: auto-inject polling, F4/F5)
│       ├── logic/              # pure business logic (normalizeContent/isSkillLine/skillNameOf/cloneGroup)
│       ├── locales/            # dictionaries (zh/en)
│       ├── utils/              # generic utils (scroll/css/signal/session/navigation)
│       ├── components/         # UI components (ConfigCard/PresetSelector/PresetConfigCard)
│       └── ambient.d.ts        # minimal type stubs (react / primitives provided by the browser runtime)
├── scripts/build.mjs       # esbuild build (pnpm build): backend → lib/index.js, frontend → lib/client.js
├── lib/index.js            # backend build artifact (committed)
├── lib/client.js           # frontend build artifact (committed; rebuild after frontend changes)
└── docs/
    ├── zh/                 # Chinese docs
    └── en/                 # English docs
```

> The repo ships **no** `cordis.yml` / `--patch` local-load config. The plugin is installed only via the official `dsh plugin add/remove` commands.

## Building

```bash
pnpm install          # install dependencies (schemastery / yaml / esbuild / typescript)
pnpm build            # build → lib/index.js + lib/client.js
pnpm typecheck        # tsc --noEmit type check
```

> This plugin is the **first third-party caller of the `setDraft` input-write channel** (no precedent in the dsh codebase). The channel is a public official API, but testing should focus on the inject behavior.

## dsh 0.2.0 adaptation (settings architecture rework)

dsh 0.2.0 removed the old settings-provider stack (`installSettingsSection` / `settingsNamespace` / `settingsScope` / `settings.plugin.item` are all gone) in favor of "volatile-field form projection of the Loader entry config":

- **Namespace** = the **Loader entry id** (here: `bundle.patch.yml`'s id = package name `dsh-message-injector`)
- **Config declaration**: the backend exports a `Config` schema; fields exposed to the config card/persistence must be `.volatile()`; `apply(ctx, config)` reads live values via `config.groups.get() / config.selected.get()`
- **Persistence**: writes land in the profile patch `$DSH_HOME/profiles/<profile>/cordis.patch.yml` under the `dsh-message-injector` entry (done by the official settings service + config-editor), no longer `$DSH_HOME/settings.yaml`
- **Change notification**: `ctx.on('loader/volatile-update', cb)` is available (fiber-filtered, own entry only), but you must **not write config from its callback** — the event fires inside an HMR transaction and a nested `runExclusive` is always rejected ("HMR transactions cannot be nested")
- **Auto-deselect (F6-6) migration**: since the volatile-update callback cannot write back, the selection is cleared in the same `mutate` as the `groups` save in the frontend config card (the only path that can delete/disable the selected group); the selector and the injector additionally guard against a stale selection (treated as not selected / not injected), so external edits degrade gracefully
- **Frontend read/write**: `ctx.configForms.get(entryId)` (ConfigForm: stable snapshot + subscribe + set/mutate; `set` resolves `false` when rejected/read-only, rejects only on transport errors) → adapted to `ScopeLike` in the entry so components never depend on official types
- **Config card mount point**: `plugins.bundle.config` (Plugins page bundle detail, key = package name), gated by `configForms.whileServed([id], ...)`
- **Hard validation migration**: 0.2.0 has no per-namespace `validate` hook — unique names / non-empty content are enforced by the frontend card before saving; the backend stays tolerant, with auto-deselect as the safety net
- **Legacy import**: one-time read of the `message-injector` section from `$DSH_HOME/settings.yaml(.imported)` into the new entry (only while the entry's user layer is empty; modeled after dsh-better-sidebar's `importLegacyPrefs`)

## Key mechanisms (verified during development)

- **UI injection**: `ctx.slots.inject('conversation.input.left', ...)` registers a list-slot component (the official seat at the bottom-left of the composer); the config card goes through `plugins.bundle.config` (key = package name `dsh-message-injector`)
- **Config card look**: replicates the official dsh config card shell (collapsible header + form body + discard/save footer), abstracted into the **generic component `src/client/components/ConfigCard.tsx`** — props: title/description/children/dirty/saving/invalid/failed/onSave/onDiscard plus the `expandSignal` (pending consume + live subscribe) and auto-reveal after signal expansion; the field style classes (psi-field/input/textarea/check etc.) are injected with the component's CSS for children to use. Visual parameters match the official cards (radius 12 / border l2 / bg layer-3 / input 34px), all through `--dsw-alias-*` tokens with our own class names; **never reference dsh's internal CSS class names** (build hashes — they break on every upgrade; see pitfall 7 in the Chinese dev-notes doc)
- **Scroll control**: generic module `src/client/utils/scroll.ts` — `scrollElementIntoView` (aligns an element within its nearest scrollable container; start/center/nearest) plus the `useReveal(open, when)` hook (one-shot signal-driven reveal; manual actions never scroll). Both the new-group reveal and the settings-shortcut card reveal reuse it
- **CSS injection**: generic util `src/client/utils/css.ts` `injectStyle(tagId, css)` (data-plugin-css mechanism; injected once per tagId). Config-card styles are injected by the ConfigCard component; selector/group styles by their own components
- **Frontend layering**: the entry `index.tsx` only wires things up (composition root); UI components (components/), data access (api/), business services (services/), pure logic (logic/), dictionaries (locales/), and generic utils (utils/) each live in their own directory. The settings-shortcut signal uses the one-shot signal from `utils/signal.ts`; plugin-page navigation uses `utils/navigation.ts`; current-session lookup uses `utils/session.ts`
- **Settings shortcut**: the 「Settings」 item at the bottom of the selector menu → module-level expand signal + the official navigation service `ctx.get('pluginNavigation')?.openBundle(packageName)` (falls back to `layout.selectPanel('plugins')`, then a DOM fallback on `li[data-plugin-package]`); every step degrades gracefully (see the 0.2.0 migration pitfalls in the Chinese dev-notes doc)
- **Input read/write**: official channel `input.setDraft(text)` (`conversation.input.for(actx)`; the composer is a React controlled component — never touch the DOM directly); emptiness is read via `input.state.getSnapshot()` (draft/phase)
- **Current session**: 0.2.0's `SessionListState` has no `current` field — the open session is the one with `retainedBy.mainView > 0` (the official idiom, see `utils/session.ts`)
- **Config persistence**: backend exports a `.volatile()` Config (namespace = entry id); frontend `ctx.configForms.get(entryId)` reads/writes it (synced across tabs)
- **Skill validation**: `ctx.remote.skills.list({sessionId})` validates `/`-prefixed skill-invocation lines (the old `connection.api.skills` was removed; without a session the check is unavailable → those lines are injected as configured)

## Gotchas

- `useSyncExternalStore` must wrap `scope.getSnapshot/subscribe` in arrow functions, otherwise `this` is lost and rendering crashes (ConfigForm methods depend on `this.store`); the snapshot getter must stay a stable pass-through (never rebuild a new object per call)
- The frontend must be **pre-built** as plain JS (the browser has no TS compiler); the artifact uses the `window.__ModuleLoader__.load({id, factory})` form
- A plugin must declare `dsh.bundle` in package.json, otherwise `dsh plugin add` installs it as a plain dependency and it never activates
- dsh's internal CSS class names are build hashes (e.g. `YyYd_a_card`); referencing them breaks silently on every dsh upgrade — trust only the `--dsw-alias-*` design tokens (pitfall 7 in the Chinese dev-notes doc)
- 0.2.0 migration pitfalls (details in the Chinese dev-notes doc, pitfalls 9–12): a `declare module` for a real module inside a non-module `.d.ts` shadows all its exports (module augmentation must live in a module file); cordis 4 `ctx.effect` callbacks must return a disposer; pnpm needs `autoInstallPeers: false` or it pulls the whole dsh as a dependency; the old settings helper cannot be kept behind a feature-detect branch (0.2.0 fails at module link time)

## Official references

- dsh plugin development tutorial: https://deepseek-harness.github.io/deepseek-harness/develop/basic/
