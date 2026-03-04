import {App} from "obsidian";
import init, {DiaryxBackend} from "@diaryx/wasm-node";
import {createVaultFs} from "./vault-fs";
import wasmDataUrl from "@diaryx/wasm-node/diaryx_wasm_bg.wasm?url";

let initialized = false;

/**
 * Decode an embedded data URL (`data:application/wasm;base64,...`) to bytes.
 */
function decodeWasmDataUrl(dataUrl: string): Uint8Array {
	const base64 = dataUrl.split(",", 2)[1];
	if (!base64) throw new Error("Embedded WASM data URL is invalid.");

	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

async function initWasm(): Promise<void> {
	if (initialized) return;

	const wasmBinary = decodeWasmDataUrl(wasmDataUrl);
	await init({ module_or_path: wasmBinary });
	initialized = true;
}

/**
 * Create a DiaryxBackend backed by the Obsidian Vault filesystem.
 *
 * Initializes the WASM module if not already done, then creates a backend
 * that delegates all filesystem operations to the Vault adapter.
 */
export async function createBackend(app: App): Promise<DiaryxBackend> {
	await initWasm();

	const callbacks = createVaultFs(app);

	return DiaryxBackend.createFromJsFileSystem(callbacks);
}
