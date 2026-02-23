import {App} from "obsidian";
import type {JsFileSystemCallbacks} from "@diaryx/wasm-node";

/**
 * Bridge Obsidian's Vault adapter API to the JsFileSystemCallbacks
 * interface expected by DiaryxBackend.createFromJsFileSystem().
 */
export function createVaultFs(app: App): JsFileSystemCallbacks {
	const adapter = app.vault.adapter;

	return {
		readToString: (path: string) => adapter.read(path),
		writeFile: (path: string, content: string) => adapter.write(path, content),
		deleteFile: (path: string) => adapter.remove(path),
		exists: (path: string) => adapter.exists(path),
		isDir: async (path: string) => {
			const stat = await adapter.stat(path);
			return stat?.type === "folder";
		},
		listFiles: async (dir: string) => {
			const listing = await adapter.list(dir);
			return [...listing.files, ...listing.folders];
		},
		listMdFiles: async (dir: string) => {
			const listing = await adapter.list(dir);
			return listing.files.filter((f: string) => f.endsWith(".md"));
		},
		createDirAll: (path: string) => adapter.mkdir(path),
		moveFile: (from: string, to: string) => adapter.rename(from, to),
		readBinary: async (path: string) => {
			const buf = await adapter.readBinary(path);
			return new Uint8Array(buf);
		},
		writeBinary: (path: string, data: Uint8Array) =>
			adapter.writeBinary(path, data.buffer as ArrayBuffer),
	};
}
