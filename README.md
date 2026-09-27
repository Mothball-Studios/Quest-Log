# Quest Log (durable build tree)

This directory is the **durable git tree** for Quest Log. It is **not** the Obsidian plugin folder.

## Standing split

- **Here** (`/workspace/Quest-Log-src`): source (`src/`), `.git`, `package.json`, build scripts. Remote: `https://github.com/m1n1m0th42/Quest-Log.git`
- **Vault plugin** (`…/Mothball Studios/.obsidian/plugins/quest-log/`): deployable only — `main.js`, `manifest.json`, `styles.css`, plus runtime `data.json`

Never make the plugin folder the git root again.

## Commands

```bash
npm run build   # bundle src/main.js → main.js (CJS, external: obsidian)
npm run ship    # build + copy only main.js, styles.css, manifest.json into vault plugin
```

`npm run ship` does **not** copy `src/`, `node_modules/`, or `.git/`, and does **not** overwrite `data.json`.

See `/workspace/Quest-Log-BUILD.md` for the full pipeline notes.

## Version bumps (standing)

**Bump `manifest.json` (and matching `package.json` version) on every push** of Quest Log to `origin`. Never push session/product work while leaving the manifest version unchanged.
