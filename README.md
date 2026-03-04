# Diaryx Obsidian

Obsidian plugin that maintains [Diaryx](https://diaryx.org) workspace hierarchy metadata (`contents`/`part_of` frontmatter) when files are moved, renamed, created, or deleted.

## Features

- **Hierarchy sync** — Automatically updates `contents` and `part_of` frontmatter fields whenever markdown files are moved, renamed, created, or deleted in your vault.
- **Import command** — "Import vault to Diaryx format" command converts an existing vault into Diaryx's hierarchy format, adding metadata to all markdown files and creating index files for directories.
- **Settings** — Toggle hierarchy sync on or off from the plugin settings tab.

## Installation

1. Copy the plugin folder into your vault's `.obsidian/plugins/diaryx-obsidian/` directory.
2. Enable the plugin in Obsidian's Community Plugins settings.

## Development

```bash
bun install
bun run dev    # watch mode
bun run build  # production build
```

The build uses esbuild to bundle `src/main.ts` into `main.js` and copies the WASM binary (`diaryx_wasm_bg.wasm`) from `node_modules/@diaryx/wasm-node/` into the plugin root.
