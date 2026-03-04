import {Notice, Plugin, TAbstractFile, TFile} from "obsidian";
import type {DiaryxBackend} from "@diaryx/wasm-node";
import {DEFAULT_SETTINGS, DiaryxSettings, DiaryxSettingTab} from "./settings";
import {createBackend} from "./wasm";
import {ConfirmModal} from "./confirm-modal";
import {
	createImportRuntime,
	type ImportDirectoryInPlaceResult,
	type ImportRuntime,
} from "./import-plugin";

export default class DiaryxPlugin extends Plugin {
	settings: DiaryxSettings;
	backend: DiaryxBackend | null = null;
	importRuntime: ImportRuntime | null = null;

	async onload() {
		await this.loadSettings();

		// Always register commands (import is a one-time action, not gated by enabled)
		this.addCommand({
			id: "import-vault-format",
			name: "Import vault to Diaryx format",
			callback: () => this.importVault(),
		});

		this.addSettingTab(new DiaryxSettingTab(this.app, this));

		if (!this.settings.enabled) return;

		// Initialize backend asynchronously — don't block plugin load
		void this.initBackend();

		// Hook into vault events to keep hierarchy metadata in sync
		this.registerEvent(
			this.app.vault.on("rename", (file: TAbstractFile, oldPath: string) => {
				if (file instanceof TFile && file.extension === "md") {
					void this.onFileRenamed(file.path, oldPath);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("create", (file: TAbstractFile) => {
				if (file instanceof TFile && file.extension === "md") {
					void this.onFileCreated(file.path);
				}
			})
		);

		this.registerEvent(
			this.app.vault.on("delete", (file: TAbstractFile) => {
				if (file instanceof TFile && file.extension === "md") {
					void this.onFileDeleted(file.path);
				}
			})
		);
	}

	onunload() {
		if (this.backend) {
			this.backend.free();
			this.backend = null;
		}
		if (this.importRuntime) {
			void this.importRuntime.close();
			this.importRuntime = null;
		}
	}

	/** Initialize or return the WASM backend on demand. */
	private async ensureBackend(): Promise<DiaryxBackend | null> {
		if (this.backend) return this.backend;
		try {
			this.backend = await createBackend(this.app);
			return this.backend;
		} catch (e) {
			console.error("Diaryx: Failed to initialize WASM backend:", e);
			new Notice("Diaryx: failed to load. Check console for details.");
			return null;
		}
	}

	private async initBackend() {
		try {
			this.backend = await createBackend(this.app);
		} catch (e) {
			console.error("Diaryx: Failed to initialize WASM backend:", e);
			new Notice("Diaryx: failed to load. Check console for details.");
		}
	}

	/** Initialize or return the Extism import runtime on demand. */
	private async ensureImportRuntime(): Promise<ImportRuntime | null> {
		if (this.importRuntime) return this.importRuntime;
		try {
			this.importRuntime = await createImportRuntime(this.app);
			return this.importRuntime;
		} catch (e) {
			console.error("Diaryx: Failed to initialize import runtime:", e);
			new Notice("Diaryx: import runtime unavailable. Check console for details.");
			return null;
		}
	}

	private async importVault() {
		const runtime = await this.ensureImportRuntime();
		if (!runtime) return;

		const mdCount = this.app.vault.getMarkdownFiles().length;

		const confirmed = await new ConfirmModal(
			this.app,
			"Import vault to Diaryx format",
			`This will add Diaryx hierarchy metadata (part_of, contents) to ` +
			`${mdCount} markdown files in your vault. Index files will be created ` +
			`for directories that don't have one. Existing file content will not ` +
			`be modified.`,
		).waitForResult();

		if (!confirmed) return;

		const notice = new Notice("Diaryx: converting vault...", 0);
		try {
			const result: ImportDirectoryInPlaceResult = await runtime.importDirectoryInPlace("");
			notice.hide();

			const errors = result.errors;
			new Notice(
				`Diaryx: Conversion complete. ` +
				`Updated: ${result.imported ?? 0}, ` +
				`Skipped: ${result.skipped ?? 0}` +
				(errors && errors.length > 0 ? `, Errors: ${errors.length}` : ""),
				10000,
			);

			if (errors && errors.length > 0) {
				console.warn("Diaryx import errors:", errors);
			}
		} catch (e) {
			notice.hide();
			console.error("Diaryx: Import failed:", e);
			new Notice("Diaryx: import failed. Check console for details.");
		}
	}

	private async onFileRenamed(newPath: string, oldPath: string) {
		if (!this.backend) return;

		try {
			await this.backend.executeJs({
				type: "SyncMoveMetadata",
				params: {old_path: oldPath, new_path: newPath},
			});
		} catch (e) {
			console.error(`Diaryx: Failed to sync metadata for ${oldPath} -> ${newPath}:`, e);
		}
	}

	private async onFileCreated(path: string) {
		if (!this.backend) return;

		try {
			await this.backend.executeJs({
				type: "SyncCreateMetadata",
				params: {path},
			});
		} catch (e) {
			console.error(`Diaryx: Failed to sync create metadata for ${path}:`, e);
		}
	}

	private async onFileDeleted(path: string) {
		if (!this.backend) return;

		try {
			await this.backend.executeJs({
				type: "SyncDeleteMetadata",
				params: {path},
			});
		} catch (e) {
			console.error(`Diaryx: Failed to sync delete metadata for ${path}:`, e);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<DiaryxSettings>);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
