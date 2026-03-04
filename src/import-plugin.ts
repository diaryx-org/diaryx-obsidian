import {App} from "obsidian";
import createPlugin, {type CallContext, type Plugin as ExtismPlugin} from "@extism/extism";
import importWasmDataUrl from "./assets/diaryx_import_extism.wasm?url";

interface CommandResponse {
	success: boolean;
	data?: unknown;
	error?: string;
}

interface VaultAdapter {
	read(path: string): Promise<string>;
	write(path: string, content: string): Promise<void>;
	remove(path: string): Promise<void>;
	exists(path: string): Promise<boolean>;
	list(path: string): Promise<{files: string[]; folders: string[]}>;
	writeBinary(path: string, data: ArrayBuffer): Promise<void>;
}

export interface ImportDirectoryInPlaceResult {
	imported?: number;
	skipped?: number;
	errors?: string[];
	attachment_count?: number;
}

export interface ImportRuntime {
	importDirectoryInPlace(path?: string): Promise<ImportDirectoryInPlaceResult>;
	close(): Promise<void>;
}

function decodeWasmDataUrl(dataUrl: string): Uint8Array {
	const base64 = dataUrl.split(",", 2)[1];
	if (!base64) {
		throw new Error("Embedded import WASM data URL is invalid.");
	}

	const BufferCtor = (globalThis as {Buffer?: typeof globalThis.Buffer}).Buffer;
	if (BufferCtor) {
		return new Uint8Array(BufferCtor.from(base64, "base64"));
	}

	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function base64ToBytes(encoded: string): Uint8Array {
	const BufferCtor = (globalThis as {Buffer?: typeof globalThis.Buffer}).Buffer;
	if (BufferCtor) {
		return new Uint8Array(BufferCtor.from(encoded, "base64"));
	}

	const binary = atob(encoded);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}

async function listFilesRecursive(adapter: VaultAdapter, dir: string): Promise<string[]> {
	const files: string[] = [];

	const walk = async (path: string): Promise<void> => {
		const listing = await adapter.list(path);
		for (const file of listing.files) {
			files.push(file);
		}
		for (const folder of listing.folders) {
			await walk(folder);
		}
	};

	await walk(dir);
	return files;
}

function buildHostFunctions(app: App) {
	const adapter = app.vault.adapter as unknown as VaultAdapter;

	return {
		"extism:host/user": {
			host_log(cp: CallContext, offs: bigint) {
				try {
					const input = cp.read(offs)?.json() as
						| {level?: string; message?: string}
						| undefined;
					if (!input?.message) return cp.store("");

					switch (input.level) {
						case "error":
							console.error("[diaryx.import]", input.message);
							break;
						case "warn":
							console.warn("[diaryx.import]", input.message);
							break;
						case "debug":
							console.debug("[diaryx.import]", input.message);
							break;
						default:
							console.debug("[diaryx.import]", input.message);
					}
					return cp.store("");
				} catch {
					return cp.store("");
				}
			},
			async host_read_file(cp: CallContext, offs: bigint) {
				try {
					const input = cp.read(offs)?.json() as {path?: string} | undefined;
					if (!input?.path) return cp.store("");
					return cp.store(await adapter.read(input.path));
				} catch {
					return cp.store("");
				}
			},
			async host_list_files(cp: CallContext, offs: bigint) {
				try {
					const input = cp.read(offs)?.json() as {prefix?: string} | undefined;
					const prefix = input?.prefix?.trim() ?? "";
					const files = await listFilesRecursive(adapter, prefix);
					return cp.store(JSON.stringify(files));
				} catch {
					return cp.store("[]");
				}
			},
			async host_file_exists(cp: CallContext, offs: bigint) {
				try {
					const input = cp.read(offs)?.json() as {path?: string} | undefined;
					if (!input?.path) return cp.store("false");
					const exists = await adapter.exists(input.path);
					return cp.store(exists ? "true" : "false");
				} catch {
					return cp.store("false");
				}
			},
			async host_write_file(cp: CallContext, offs: bigint) {
				try {
					const input = cp.read(offs)?.json() as
						| {path?: string; content?: string}
						| undefined;
					if (!input?.path || typeof input.content !== "string") return cp.store("");
					await adapter.write(input.path, input.content);
					return cp.store("");
				} catch {
					return cp.store("");
				}
			},
			async host_write_binary(cp: CallContext, offs: bigint) {
				try {
					const input = cp.read(offs)?.json() as
						| {path?: string; content?: string}
						| undefined;
					if (!input?.path || typeof input.content !== "string") return cp.store("");
					const bytes = base64ToBytes(input.content);
					await adapter.writeBinary(input.path, toArrayBuffer(bytes));
					return cp.store("");
				} catch {
					return cp.store("");
				}
			},
			async host_delete_file(cp: CallContext, offs: bigint) {
				try {
					const input = cp.read(offs)?.json() as {path?: string} | undefined;
					if (!input?.path) return cp.store("");
					await adapter.remove(input.path);
					return cp.store("");
				} catch {
					return cp.store("");
				}
			},
			async host_request_file(cp: CallContext, _offs: bigint) {
				return cp.store("");
			},
			async host_storage_get(cp: CallContext, _offs: bigint) {
				return cp.store("");
			},
			async host_storage_set(cp: CallContext, _offs: bigint) {
				return cp.store("");
			},
			host_get_timestamp(cp: CallContext, _offs: bigint) {
				return cp.store(Date.now().toString());
			},
			async host_http_request(cp: CallContext, _offs: bigint) {
				return cp.store(JSON.stringify({status: 0, headers: {}, body: "HTTP disabled"}));
			},
			host_emit_event(cp: CallContext, _offs: bigint) {
				return cp.store("");
			},
			host_ws_request(cp: CallContext, _offs: bigint) {
				return cp.store("");
			},
			async host_run_wasi_module(cp: CallContext, _offs: bigint) {
				return cp.store(JSON.stringify({exit_code: -1, stdout: "", stderr: "WASI host modules disabled"}));
			},
		},
	};
}

function isOptionalExportMissing(error: unknown, exportName: "init" | "shutdown"): boolean {
	const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
	return (
		message.includes("function not found") ||
		message.includes("unknown function") ||
		message.includes("no such export") ||
		(message.includes("not found") && message.includes(exportName))
	);
}

class ExtismImportRuntime implements ImportRuntime {
	private closed = false;
	private callQueue: Promise<void> = Promise.resolve();

	constructor(private readonly plugin: ExtismPlugin) {}

	async initialize(): Promise<void> {
		await this.callLifecycle("init");
	}

	async importDirectoryInPlace(path = ""): Promise<ImportDirectoryInPlaceResult> {
		const data = await this.callCommand("ImportDirectoryInPlace", {path});
		if (typeof data === "object" && data !== null) {
			return data as ImportDirectoryInPlaceResult;
		}
		return {};
	}

	async close(): Promise<void> {
		if (this.closed) return;
		this.closed = true;

		try {
			await this.callLifecycle("shutdown");
		} catch (error) {
			console.warn("Diaryx: import runtime shutdown failed", error);
		}
		await this.plugin.close();
	}

	private enqueue<T>(fn: () => Promise<T>): Promise<T> {
		const next = this.callQueue.then(fn, fn);
		this.callQueue = next.then(
			() => undefined,
			() => undefined,
		);
		return next;
	}

	private async callLifecycle(exportName: "init" | "shutdown"): Promise<void> {
		await this.enqueue(async () => {
			try {
				await this.plugin.call(exportName, "{}");
			} catch (error) {
				if (isOptionalExportMissing(error, exportName)) {
					return;
				}
				throw error;
			}
		});
	}

	private async callCommand(
		command: string,
		params: Record<string, unknown>,
	): Promise<unknown> {
		return this.enqueue(async () => {
			const request = JSON.stringify({command, params});
			const output = await this.plugin.call("handle_command", request);
			if (!output) {
				throw new Error(`Import plugin command returned no result: ${command}`);
			}
			const response = output.json() as CommandResponse;
			if (!response.success) {
				throw new Error(response.error ?? `Import command failed: ${command}`);
			}
			return response.data;
		});
	}
}

export async function createImportRuntime(app: App): Promise<ImportRuntime> {
	const wasmBytes = decodeWasmDataUrl(importWasmDataUrl);
	const plugin = await createPlugin(toArrayBuffer(wasmBytes), {
		useWasi: true,
		functions: buildHostFunctions(app),
	});

	const runtime = new ExtismImportRuntime(plugin);
	await runtime.initialize();
	return runtime;
}
