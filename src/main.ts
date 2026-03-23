import { Plugin, WorkspaceLeaf, PluginSettingTab, App, Setting, MarkdownView, debounce, SecretComponent, TFile } from "obsidian";
import { AirtableView, VIEW_TYPE_AIRTABLE } from "./AirtableView";
import { airtableStore, LinkSyncService } from "./features/airtable";
import { PLUGIN_NAME } from "./pluginMeta";
// M9: static import instead of inline require()
import { FileExplorerDecorator } from "./services/fileExplorerDecorator";

interface AirtableSettings {
	apiKeySecretName: string;
	baseId: string;
	cacheTableInfoMinutes: number;
	cacheRecordsMinutes: number;
	enableCachePersistence: boolean;
	autoOpenView: boolean;
	templatePath: string;
	newNoteLocation: string;
	obsidianLinkFieldName: string;
	autoCreateLinkField: boolean;
	highlightLinkedNotes: boolean;
}

const DEFAULT_SETTINGS: AirtableSettings = {
	apiKeySecretName: "",
	baseId: "",
	cacheTableInfoMinutes: 30,
	cacheRecordsMinutes: 5,
	enableCachePersistence: true,
	autoOpenView: true,
	templatePath: "Templates/Airtable Record.md",
	newNoteLocation: "References",
	obsidianLinkFieldName: "Obsidian Link",
	autoCreateLinkField: true,
	highlightLinkedNotes: true,
};

export default class ObsidianLocaltablePlugin extends Plugin {
	settings: AirtableSettings;

	// H8: concurrency guard for ensureViewExists
	private _creatingView = false;
	// Path-equality dedup for the double-fire Obsidian bug
	private _lastActivePath: string | null = null;
	// File explorer decorator for highlighting linked notes
	private _decorator: FileExplorerDecorator | null = null;
	private _linkSyncService: LinkSyncService | null = null;
	private _pendingRenameSyncs = new Map<string, number>();

	/**
	 * Resolves the actual Airtable API key from SecretStorage using the
	 * secret name stored in settings.
	 */
	async getApiKey(): Promise<string> {
		// Try SecretStorage (Obsidian >= 1.11.4)
		const name = this.settings.apiKeySecretName;
		if (name) {
			try {
				const secretStorage = (this.app as App & {
					secretStorage?: {
						getSecret?: (id: string) => Promise<string | null>;
						get?: (id: string) => Promise<string | null>;
					};
				}).secretStorage;
				if (secretStorage?.getSecret) {
					const secret = await secretStorage.getSecret(name);
					if (secret) return secret;
				}
				if (secretStorage?.get) {
					const secret = await secretStorage.get(name);
					if (secret) return secret;
				}
			} catch {
				// secretStorage unavailable — fall through
			}
		}

		return "";
	}

	async onload() {
		await this.loadSettings();

		this.registerView(VIEW_TYPE_AIRTABLE, (leaf) => new AirtableView(leaf, this));

		// Single event for file-change tracking. active-leaf-change fires on
		// every pane-focus switch including tab changes (file-open misses those).
		// instanceof MarkdownView guard skips sidebar/graph/canvas panes.
		// Debounce collapses the known Obsidian double-fire on the same switch.
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", this._onLeafChange)
		);

		// File explorer decorator — highlight Airtable-linked notes
		this._decorator = new FileExplorerDecorator(this.app);
		this._linkSyncService = new LinkSyncService(this.app);

		this.app.workspace.onLayoutReady(() => {
			this.handleFileChange();
			if (this.settings.highlightLinkedNotes) {
				this._decorator!.enable();
			}
		});

		// Refresh decorator when files are created, deleted, or renamed
		this.registerEvent(this.app.vault.on("create", () => this._decorator?.refresh()));
		this.registerEvent(this.app.vault.on("delete", () => this._decorator?.refresh()));
		this.registerEvent(this.app.vault.on("rename", (file) => {
			this._decorator?.refresh();
			if (file instanceof TFile) {
				this.scheduleRenameSync(file);
			}
		}));

		// Refresh when frontmatter changes on any file (covers uuid being added/removed)
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				const active = this.app.workspace.getActiveFile();
				if (active && file.path === active.path) this.handleFileChange();
				this._decorator?.refresh();
			})
		);

		// Refresh when file explorer is opened (layout-change covers sidebar toggles)
		this.registerEvent(
			this.app.workspace.on("layout-change", () => this._decorator?.refresh())
		);

		this.addSettingTab(new LocaltableSettingTab(this.app, this));

		this.addRibbonIcon("database", `Open ${PLUGIN_NAME}`, () => this.activateView());

		this.addCommand({ id: "open-localtable", name: `Open ${PLUGIN_NAME}`, callback: () => this.activateView() });
		this.addCommand({ id: "toggle-localtable", name: `Toggle ${PLUGIN_NAME}`, callback: () => this.toggleView() });
		this.addCommand({
			id: "ensure-link-field",
			name: "Ensure link field",
			checkCallback: (checking) => {
				const hasTable = !!airtableStore.getCurrentAirtableMetadata() || !!this.app.workspace.getActiveFile();
				if (!checking) {
					void airtableStore.ensureLinkField();
				}
				return hasTable;
			},
		});

		this.addCommand({
			id: "open-in-airtable",
			name: "Open current note in Airtable",
			checkCallback: (checking) => {
				const metadata = airtableStore.getCurrentAirtableMetadata();
				if (metadata) {
					if (!checking) airtableStore.openRecordInBrowser();
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: "sync-link-to-airtable",
			name: "Sync link to Airtable",
			checkCallback: (checking) => {
				const metadata = airtableStore.getCurrentAirtableMetadata();
				if (metadata) {
					if (!checking) airtableStore.syncLinkToAirtable();
					return true;
				}
				return false;
			}
		});

	}

	async onunload() {
		for (const timeoutId of this._pendingRenameSyncs.values()) {
			window.clearTimeout(timeoutId);
		}
		this._pendingRenameSyncs.clear();
		this._linkSyncService = null;
		this._decorator?.destroy();
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_AIRTABLE);
	}

	private scheduleRenameSync(file: TFile): void {
		if (file.extension !== "md") return;

		const existingTimeout = this._pendingRenameSyncs.get(file.path);
		if (existingTimeout !== undefined) {
			window.clearTimeout(existingTimeout);
		}

		const timeoutId = window.setTimeout(() => {
			this._pendingRenameSyncs.delete(file.path);
			void this.syncRenamedFile(file);
		}, 600);

		this._pendingRenameSyncs.set(file.path, timeoutId);
	}

	private async syncRenamedFile(file: TFile): Promise<void> {
		if (!this._linkSyncService) return;

		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter;
		if (!frontmatter?.uuid || !String(frontmatter.uuid).startsWith("rec")) return;
		if (!frontmatter?.airtable_table_id) return;
		if (!this.settings.baseId || !this.settings.obsidianLinkFieldName) return;

		const apiKey = await this.getApiKey();
		if (!apiKey) return;

		await this._linkSyncService.syncFile(
			file,
			apiKey,
			this.settings.baseId,
			this.settings.obsidianLinkFieldName,
		);
	}

	/** Debounced active-leaf-change handler — collapses the Obsidian double-fire. */
	private _onLeafChange = debounce(
		(leaf: WorkspaceLeaf | null) => {
			if (!(leaf?.view instanceof MarkdownView)) return;
			const file = leaf.view.file;
			if (!file) return;
			if (file.path === this._lastActivePath) return; // path-equality dedup
			this._lastActivePath = file.path;
			this.handleFileChange();
		},
		50,
		true
	);

	/** Auto-open: ensure the view leaf exists without stealing focus. */
	private handleFileChange() {
		if (!this.settings.autoOpenView) return;
		const activeFile = this.app.workspace.getActiveFile();
		if (!activeFile) return;
		const cache = this.app.metadataCache.getFileCache(activeFile);
		const fm = cache?.frontmatter;
		const hasAirtableData =
			fm?.airtable_table_id ||
			(fm?.uuid && String(fm.uuid).startsWith("rec"));
		if (hasAirtableData) this.ensureViewExists();
	}

	/** H7+H8: create leaf only if missing, no focus steal, with concurrency guard. */
	private async ensureViewExists() {
		if (this._creatingView) return;
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_AIRTABLE);
		if (leaves.length > 0) return;
		this._creatingView = true;
		try {
			const leaf = this.app.workspace.getRightLeaf(false);
			if (leaf) {
				// H7: active:false — don't steal focus on auto-open
				await leaf.setViewState({ type: VIEW_TYPE_AIRTABLE, active: false });
			}
		} finally {
			this._creatingView = false;
		}
	}

	/** User-triggered: create + reveal (steal focus intentionally). */
	async activateView() {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_AIRTABLE);
		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			if (leaf) await leaf.setViewState({ type: VIEW_TYPE_AIRTABLE, active: true });
		}
		if (leaf) workspace.revealLeaf(leaf);
	}

	async toggleView() {
		const { workspace } = this.app;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_AIRTABLE);
		if (leaves.length > 0) {
			leaves.forEach(leaf => leaf.detach());
		} else {
			await this.activateView();
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	/** Called by the settings tab when highlightLinkedNotes is toggled. */
	applyDecoratorSetting(): void {
		if (!this._decorator) return;
		if (this.settings.highlightLinkedNotes) {
			this._decorator.enable();
		} else {
			this._decorator.disable();
		}
	}
}

class LocaltableSettingTab extends PluginSettingTab {
	plugin: ObsidianLocaltablePlugin;

	constructor(app: App, plugin: ObsidianLocaltablePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName(PLUGIN_NAME)
			.setHeading();

		// API Settings
		new Setting(containerEl)
			.setName("API settings")
			.setHeading();

		new Setting(containerEl)
			.setName("Airtable API key")
			.setDesc("Select a secret from SecretStorage. The key is stored securely and never written to data.json.")
			.addComponent(el => new SecretComponent(this.app, el)
				.setValue(this.plugin.settings.apiKeySecretName)
				.onChange(async (value) => {
					this.plugin.settings.apiKeySecretName = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Airtable base ID")
			.setDesc("Your Airtable base ID (starts with 'app')")
			.addText(text => text
				.setPlaceholder("appXXXXXXXXXXXXXX")
				.setValue(this.plugin.settings.baseId)
				.onChange(async (value) => {
					this.plugin.settings.baseId = value;
					await this.plugin.saveSettings();
				}));

		// View Settings
		new Setting(containerEl)
			.setName("View settings")
			.setHeading();

		// H4: removed duplicate auto-open toggle — only one here
		new Setting(containerEl)
			.setName("Auto-open view")
			.setDesc("Automatically open the Airtable view when opening a note with Airtable frontmatter.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoOpenView)
				.onChange(async (value) => {
					this.plugin.settings.autoOpenView = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Highlight linked notes in file explorer")
			.setDesc("Bold and mark notes linked to an Airtable record with a valid `uuid` frontmatter field.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.highlightLinkedNotes)
				.onChange(async (value) => {
					this.plugin.settings.highlightLinkedNotes = value;
					await this.plugin.saveSettings();
					this.plugin.applyDecoratorSetting();
				}));

		// Cache Settings
		new Setting(containerEl)
			.setName("Cache settings")
			.setHeading();

		new Setting(containerEl)
			.setName("Table info cache duration")
			.setDesc("How long to cache table metadata (in minutes)")
			.addSlider(slider => slider
				.setLimits(1, 120, 1)
				.setValue(this.plugin.settings.cacheTableInfoMinutes)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.cacheTableInfoMinutes = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Records cache duration")
			.setDesc("How long to cache record data (in minutes)")
			.addSlider(slider => slider
				.setLimits(1, 60, 1)
				.setValue(this.plugin.settings.cacheRecordsMinutes)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.cacheRecordsMinutes = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Enable cache persistence")
			.setDesc("Save cache to disk so it survives Obsidian restarts.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableCachePersistence)
				.onChange(async (value) => {
					this.plugin.settings.enableCachePersistence = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Clear all cache")
			.setDesc("Clear all cached Airtable integration data.")
			.addButton(button => button
				.setButtonText("Clear Cache")
				.setWarning()
				.onClick(async () => {
					airtableStore.clearCache();
					button.setButtonText("Cleared!");
					// Timer on potentially-detached button is acceptable (no-op if detached)
					setTimeout(() => button.setButtonText("Clear Cache"), 2000);
				}));

		// Note generation
		new Setting(containerEl)
			.setName("Note generation")
			.setHeading();

		new Setting(containerEl)
			.setName("Template file path")
			.setDesc("Path to the Markdown file to use as a template (e.g., Templates/Record.md)")
			.addText(text => text
				.setPlaceholder("Templates/Record.md")
				.setValue(this.plugin.settings.templatePath)
				.onChange(async (value) => {
					this.plugin.settings.templatePath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("New note location")
			.setDesc("Folder where new notes will be created")
			.addText(text => text
				.setPlaceholder("Reference")
				.setValue(this.plugin.settings.newNoteLocation)
				.onChange(async (value) => {
					this.plugin.settings.newNoteLocation = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Obsidian link field name")
			.setDesc("Name of the Airtable field that contains the Obsidian link")
			.addText(text => text
				.setPlaceholder("Obsidian Link")
				.setValue(this.plugin.settings.obsidianLinkFieldName)
				.onChange(async (value) => {
					this.plugin.settings.obsidianLinkFieldName = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName("Auto-create link field")
			.setDesc("Automatically create the Obsidian link field in Airtable if it doesn't exist. When disabled, use Ensure Link Field manually.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoCreateLinkField)
				.onChange(async (value) => {
					this.plugin.settings.autoCreateLinkField = value;
					await this.plugin.saveSettings();
				}));
	}
}
