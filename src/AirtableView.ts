import { ItemView, WorkspaceLeaf, TFile, MarkdownView, debounce } from "obsidian";
import { mount, unmount } from "svelte";
import { writable } from "svelte/store";
import AirtableComponent from "./AirtableComponent.svelte";
import type ObsidianLocaltablePlugin from "./main";
import { PLUGIN_NAME, VIEW_TYPE_AIRTABLE } from "./pluginMeta";

export { VIEW_TYPE_AIRTABLE } from "./pluginMeta";

export class AirtableView extends ItemView {
    private component: ReturnType<typeof mount> | null = null;
    // Svelte 3 writable store — the only way to push updates into a mounted
    // Svelte 5 component from outside (plain prop mutation is not observable).
    readonly currentFile$ = writable<TFile | null>(null);
    plugin: ObsidianLocaltablePlugin;

    // Path-equality dedup: avoids double-refresh from the known Obsidian bug
    // where active-leaf-change fires twice on the same file switch.
    private _lastPath: string | null = null;

    constructor(leaf: WorkspaceLeaf, plugin: ObsidianLocaltablePlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() { return VIEW_TYPE_AIRTABLE; }
    getDisplayText() { return PLUGIN_NAME; }
    getIcon(): string { return "database"; }

    async onOpen() {
        if (this.component) {
            unmount(this.component);
            this.component = null;
        }

        const container = this.containerEl.children[1];
        container.empty();

        // Seed with the file that is active right now.
        const initial = this.app.workspace.getActiveFile();
        this._lastPath = initial?.path ?? null;
        this.currentFile$.set(initial);

        this.component = mount(AirtableComponent, {
            target: container,
            props: {
                app: this.app,
                plugin: this.plugin,
                currentFile$: this.currentFile$,
            },
        });

        // ── Primary file-change event ─────────────────────────────────────
        // active-leaf-change fires on every pane-focus switch, including when
        // the user switches between already-open tabs (file-open does NOT fire
        // in that case). Guard with instanceof MarkdownView to skip sidebar
        // panels, graph, etc. Debounce handles the known Obsidian double-fire.
        this.registerEvent(
            this.app.workspace.on("active-leaf-change", this._onLeafChange)
        );

        // ── Frontmatter change ────────────────────────────────────────────
        // Re-evaluate when frontmatter is edited (e.g. user types
        // airtable_table_id). Bounce through null so the component's $effect
        // always sees a value change even when TFile reference is identical.
        this.registerEvent(
            this.app.metadataCache.on("changed", (file) => {
                if (file.path === this._currentFileValue()?.path) {
                    this.currentFile$.set(null);
                    setTimeout(() => this.currentFile$.set(file), 10);
                }
            })
        );

        // ── Rename ────────────────────────────────────────────────────────
        this.registerEvent(
            this.app.vault.on("rename", (file, oldPath) => {
                if (!(file instanceof TFile)) return;
                if (this._currentFileValue()?.path === oldPath) {
                    this._lastPath = file.path;
                    this.currentFile$.set(file);
                }
            })
        );

        // ── Delete ────────────────────────────────────────────────────────
        this.registerEvent(
            this.app.vault.on("delete", (file) => {
                if (!(file instanceof TFile)) return;
                if (this._currentFileValue()?.path === file.path) {
                    this._lastPath = null;
                    this.currentFile$.set(null);
                }
            })
        );
    }

    async onClose() {
        if (this.component) {
            unmount(this.component);
            this.component = null;
        }
    }

    // ── Private helpers ───────────────────────────────────────────────────

    /** Debounced handler — collapses the known Obsidian double-fire. */
    private _onLeafChange = debounce(
        (leaf: WorkspaceLeaf | null) => {
            if (!(leaf?.view instanceof MarkdownView)) return;
            const file = leaf.view.file;
            if (!file) return;
            // Path-equality guard — skip if we already show this file.
            if (file.path === this._lastPath) return;
            this._lastPath = file.path;
            this.currentFile$.set(file);
        },
        50,   // ms — short enough to feel instant, long enough to dedupe
        true  // leading edge so the first call goes through immediately
    );

    /** Synchronously read the current store value. */
    private _currentFileValue(): TFile | null {
        let value: TFile | null = null;
        const unsub = this.currentFile$.subscribe((v) => { value = v; });
        unsub();
        return value;
    }
}
