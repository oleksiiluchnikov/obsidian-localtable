import { App, setIcon, debounce } from "obsidian";

const LINKED_CLASS = "airtable-linked";
const ICON_CLASS = "airtable-linked-icon";

/**
 * FileExplorerDecorator
 *
 * Marks Airtable-linked notes in the file explorer with bold text and a small
 * database icon. A note is considered "linked" when its frontmatter contains a
 * `uuid` field whose value starts with "rec" (matching the existing detection
 * logic used elsewhere in the plugin).
 *
 * Uses the internal `fileItems` map exposed on the file-explorer view — the
 * same stable pattern used by obsidian-iconize, file-explorer-note-count, and
 * obsidian-file-color.
 */
export class FileExplorerDecorator {
	private readonly app: App;
	private enabled = false;

	constructor(app: App) {
		this.app = app;
	}

	/** Enable decoration and do an initial pass. */
	enable(): void {
		this.enabled = true;
		this.refresh();
	}

	/** Disable decoration: remove all classes and injected icons immediately. */
	disable(): void {
		this.enabled = false;
		this.clear();
	}

	/** Destroy: disable + remove the injected <style> element. */
	destroy(): void {
		this.disable();
	}

	/**
	 * Debounced refresh — safe to call from vault/metadataCache events.
	 * Uses leading-edge debounce so the first call is instant, then coalesces
	 * rapid successive calls (e.g. bulk renames) into a single pass.
	 */
	readonly refresh = debounce(
		() => {
			if (this.enabled) this._applyAll();
		},
		100,
		true,
	);

	// ─── Private helpers ──────────────────────────────────────────────────────

	private _applyAll(): void {
		const fileItems = this._getFileItems();
		if (!fileItems) return;

		for (const [path, item] of Object.entries(fileItems)) {
			const el = (item as any).selfEl as HTMLElement | undefined;
			if (!el) continue;

			const isLinked = this._isLinked(path);
			el.toggleClass(LINKED_CLASS, isLinked);
			this._syncIcon(el, isLinked);
		}
	}

	/** Remove all decorations without touching the style element. */
	private clear(): void {
		const fileItems = this._getFileItems();
		if (!fileItems) {
			// File explorer not open yet — clean up any previously decorated elements
			document.querySelectorAll(`.nav-file.${LINKED_CLASS}`).forEach((el) => {
				el.removeClass(LINKED_CLASS);
				el.querySelector(`.${ICON_CLASS}`)?.remove();
			});
			return;
		}

		for (const item of Object.values(fileItems)) {
			const el = (item as any).selfEl as HTMLElement | undefined;
			if (!el) continue;
			el.removeClass(LINKED_CLASS);
			el.querySelector(`.${ICON_CLASS}`)?.remove();
		}
	}

	/**
	 * Returns `true` when the file at `path` has `uuid` frontmatter starting
	 * with "rec" — the same heuristic used in main.ts `handleFileChange()` and
	 * `airtableStore.getCurrentRecordId()`.
	 */
	private _isLinked(path: string): boolean {
		const file = this.app.vault.getFileByPath(path);
		if (!file) return false;
		const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
		if (!fm) return false;
		const uuid = fm.uuid;
		return typeof uuid === "string" && uuid.startsWith("rec");
	}

	/**
	 * Add or remove the database icon before `.nav-file-title-content`.
	 * Idempotent — checks for an existing icon span before inserting.
	 */
	private _syncIcon(fileEl: HTMLElement, linked: boolean): void {
		const titleEl =
			fileEl.querySelector<HTMLElement>(".nav-file-title") ??
			fileEl.querySelector<HTMLElement>(".nav-folder-title");
		if (!titleEl) return;

		const contentEl = titleEl.querySelector<HTMLElement>(
			".nav-file-title-content, .nav-folder-title-content",
		);
		if (!contentEl) return;

		const existing = titleEl.querySelector<HTMLElement>(`.${ICON_CLASS}`);

		if (linked) {
			if (!existing) {
				const iconEl = titleEl.createSpan({ cls: ICON_CLASS });
				setIcon(iconEl, "database");
				titleEl.insertBefore(iconEl, contentEl);
			}
		} else {
			existing?.remove();
		}
	}

	/** Access the internal `fileItems` map from the file-explorer view. */
	private _getFileItems(): Record<string, unknown> | null {
		const leaves = this.app.workspace.getLeavesOfType("file-explorer");
		const view = leaves[0]?.view as any;
		return view?.fileItems ?? null;
	}

}
