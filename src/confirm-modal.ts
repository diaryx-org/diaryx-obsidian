import {Modal, Setting} from "obsidian";
import type {App} from "obsidian";

/**
 * Modal that asks the user to confirm a destructive action.
 * Returns a Promise<boolean> indicating whether they confirmed.
 */
export class ConfirmModal extends Modal {
	private resolved = false;
	private resolvePromise!: (value: boolean) => void;

	constructor(
		app: App,
		private title: string,
		private message: string,
	) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.createEl("h2", {text: this.title});
		contentEl.createEl("p", {text: this.message});

		new Setting(contentEl)
			.addButton(btn => btn
				.setButtonText("Convert")
				.setCta()
				.onClick(() => {
					this.resolved = true;
					this.resolvePromise(true);
					this.close();
				}))
			.addButton(btn => btn
				.setButtonText("Cancel")
				.onClick(() => {
					this.resolved = true;
					this.resolvePromise(false);
					this.close();
				}));
	}

	onClose() {
		if (!this.resolved) {
			this.resolvePromise(false);
		}
	}

	waitForResult(): Promise<boolean> {
		return new Promise(resolve => {
			this.resolvePromise = resolve;
			this.open();
		});
	}
}
