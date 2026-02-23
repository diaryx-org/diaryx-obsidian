import {App, PluginSettingTab, Setting} from "obsidian";
import type DiaryxPlugin from "./main";

export interface DiaryxSettings {
	enabled: boolean;
}

export const DEFAULT_SETTINGS: DiaryxSettings = {
	enabled: true,
};

export class DiaryxSettingTab extends PluginSettingTab {
	plugin: DiaryxPlugin;

	constructor(app: App, plugin: DiaryxPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName("Enable hierarchy sync")
			.setDesc("Automatically update contents/part_of frontmatter when files are moved or renamed.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enabled)
				.onChange(async (value) => {
					this.plugin.settings.enabled = value;
					await this.plugin.saveSettings();
				}));
	}
}
