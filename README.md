# Diaryx Obsidian

Obsidian plugin that maintains [Diaryx](https://diaryx.org) workspace hierarchy metadata (`contents`/`part_of` frontmatter) when files are moved, renamed, created, or deleted.

## Features

- **Hierarchy sync** — Automatically updates `contents` and `part_of` frontmatter fields whenever markdown files are moved, renamed, created, or deleted in your vault.
- **Import command** — "Import vault to Diaryx format" command runs core metadata sync conversion by default, and falls back to the embedded `diaryx.import` Extism plugin (`ImportDirectoryInPlace`) if the core backend is unavailable.
- **Settings** — Toggle hierarchy sync on or off from the plugin settings tab.

## Installation

1. Copy the plugin folder into your vault's `.obsidian/plugins/diaryx/` directory.
2. Enable the plugin in Obsidian's Community Plugins settings.

## Development

```bash
npm install
npm run dev    # watch mode
npm run build  # production build
```

The build uses esbuild to bundle `src/main.ts` into `main.js` and inlines WASM binaries for both:

- `@diaryx/wasm-node` core backend
- `src/assets/diaryx_import_extism.wasm` import plugin runtime
