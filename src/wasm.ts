import {App} from "obsidian";
import init, {DiaryxBackend} from "@diaryx/wasm-node";
import {createVaultFs} from "./vault-fs";

let initialized = false;

/**
 * Load the WASM binary from the plugin directory and initialize the module.
 *
 * The WASM file (diaryx_wasm_bg.wasm) must be present in the plugin's
 * directory alongside main.js and manifest.json.
 */
async function initWasm(app: App, pluginId: string): Promise<void> {
	if (initialized) return;

	const wasmPath = `${app.vault.configDir}/plugins/${pluginId}/diaryx_wasm_bg.wasm`;
	const wasmBinary = await app.vault.adapter.readBinary(wasmPath);
	await init({ module_or_path: wasmBinary });
	initialized = true;
}

/**
 * Create a DiaryxBackend backed by the Obsidian Vault filesystem.
 *
 * Initializes the WASM module if not already done, then creates a backend
 * that delegates all filesystem operations to the Vault adapter.
 */
export async function createBackend(app: App, pluginId: string): Promise<DiaryxBackend> {
	await initWasm(app, pluginId);

	const callbacks = createVaultFs(app);

	// createFromJsFileSystem is available in @diaryx/wasm-node >= 1.2.0
	const backend = (DiaryxBackend as any).createFromJsFileSystem(callbacks);
	return backend;
}
