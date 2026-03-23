<script lang="ts">
import { App, Notice, TFile } from "obsidian";
import { onMount, onDestroy } from "svelte";
import type { Writable } from "svelte/store";
import type ObsidianLocaltablePlugin from "./main";

import TableView from "./features/airtable/TableView.svelte"
import PropertiesList from "./components/PropertiesList.svelte";
import EmptyState from "./ui/EmptyState.svelte";

import { airtableStore, type AirtableState, FieldResolver } from "./features/airtable";

let {
    app,
    plugin,
    currentFile$,
}: {
    app: App;
    plugin: ObsidianLocaltablePlugin;
    currentFile$: Writable<TFile | null>;
} = $props();

// ── All reactive state lives in $state variables ──────────────────────────
// We subscribe to BOTH external stores manually (currentFile$ and
// airtableStore are both Svelte 3 writables).  Keeping them as plain $state
// means no Svelte 5 $derived/$effect ever reads a Svelte-3 store directly,
// which is what caused the effect_update_depth_exceeded loop: Svelte 5 was
// detecting store.update() calls (made inside the async $effect) as
// synchronous reactive writes and treating them as a cycle.

let currentFile  = $state<TFile | null>(null);
let storeState   = $state<AirtableState | null>(null);

let unsubFile:  (() => void) | null = null;
let unsubStore: (() => void) | null = null;

// ── Convenient accessors from store state ────────────────────────────────
let tableData      = $derived(storeState?.tableData      ?? null);
let selectedRecord = $derived(storeState?.selectedRecord ?? null);

// ── DataType: pure sync derivation from frontmatter ──────────────────────
const DataType = { RECORD: "record", TABLE: "table", VIEW: "view", NONE: "none" } as const;
type DataType = typeof DataType[keyof typeof DataType];

let dataType = $derived.by<DataType>(() => {
    if (!currentFile) return DataType.NONE;
    const fm = app.metadataCache.getFileCache(currentFile)?.frontmatter;
    if (fm?.uuid && String(fm.uuid).startsWith("rec")) return DataType.RECORD;
    if (fm?.airtable_table_id)                          return DataType.TABLE;
    if (fm?.airtable_view_id)                           return DataType.VIEW;
    return DataType.NONE;
});

// ── Generation counter — cancels stale async continuations ───────────────
let orchestrationGeneration = 0;

// ── Async data loading ───────────────────────────────────────────────────
// $effect tracks currentFile and dataType (both $state/$derived).
// It NEVER reads from storeState — those updates arrive via the manual
// subscription and do not re-trigger this effect.
$effect(() => {
    const file = currentFile;  // reactive
    const type = dataType;     // reactive

    // Everything from here is a side-effect only.
	// Use a local variable to prevent the async closure capturing a stale gen.
	const gen = ++orchestrationGeneration;
	loadForFile(file, type, gen).catch((error) =>
		new Notice(`Failed to load Airtable data: ${error instanceof Error ? error.message : "Unknown error"}`)
	);
});

async function loadForFile(file: TFile | null, type: DataType, gen: number) {
    if (!file || type === DataType.NONE) {
        airtableStore.closeRecordView();
        return;
    }

    if (!app.metadataCache) return;
    const fm = app.metadataCache.getFileCache(file)?.frontmatter;

	if (type === DataType.RECORD) {
		const recordId = String(fm!.uuid);
		let targetTableId: string | null = fm!.airtable_table_id ?? null;
		if (!targetTableId) targetTableId = airtableStore.findTableForRecord(recordId);

		if (!targetTableId) {
			new Notice(`Table ID not found for record ${recordId}.`);
			return;
		}

		const tableInfoPromise = airtableStore.loadTableInfo(false, targetTableId);
		const recordPromise = airtableStore.loadRecord(recordId, targetTableId);

		await Promise.all([tableInfoPromise, recordPromise]);
		if (gen !== orchestrationGeneration) return;

		void airtableStore.resolveSelectedRecordLinks();

	} else if (type === DataType.TABLE) {
        airtableStore.closeRecordView();
        await airtableStore.loadTableInfo(false, fm!.airtable_table_id);

    } else if (type === DataType.VIEW) {
        airtableStore.closeRecordView();
    }
}

// ── Field resolver ────────────────────────────────────────────────────────
let resolver = $derived(tableData ? new FieldResolver(tableData) : null);

let recordProperties = $derived.by(() => {
    if (!selectedRecord || !tableData || !resolver) return [];
    try {
        return tableData.fields.map(field => ({
            name: field.name,
            resolved: resolver!.resolve(field.id, selectedRecord!.fields[field.name]),
            field,
        })).filter(p =>
            p.resolved.rawValue !== null &&
            p.resolved.rawValue !== undefined &&
            p.resolved.displayValue !== ""
        );
	} catch {
		return [];
	}
});

onMount(async () => {
    // Resolve the real API key from SecretStorage before initialising the store.
    const apiKey = await plugin.getApiKey();
    airtableStore.init(app, { ...plugin.settings, apiKey });

    // Subscribe to both stores outside Svelte's reactive graph.
    unsubFile  = currentFile$.subscribe((v) => { currentFile  = v; });
    unsubStore = airtableStore.subscribe((v) => { storeState   = v; });
});

onDestroy(() => {
    unsubFile?.();
    unsubStore?.();
    airtableStore.reset();
});
</script>

<div class="airtable-view-container">
    {#if dataType === DataType.RECORD}
        <div class="airtable-record">
            {#if selectedRecord}
                <div class="record-header-simple">
                    <h2>{selectedRecord.fields[tableData?.fields[0]?.name || "Name"] || "Untitled"}</h2>
                </div>
                <div class="record-details">
                    <PropertiesList title="Properties" fields={recordProperties} expanded={true} />
                </div>
            {:else}
                <div class="empty-container">
                    <EmptyState icon="search" title="Loading record" description="Fetching data..." />
                </div>
            {/if}
        </div>
    {:else if dataType === DataType.TABLE}
        <TableView {storeState} />
    {:else if dataType === DataType.VIEW}
        <pre>View mode is not yet implemented.</pre>
    {:else}
        <div class="empty-container">
            <EmptyState icon="file-question" title="No Airtable data found" description="Add `airtable_table_id` or `uuid` frontmatter" />
        </div>
    {/if}
</div>

<style>
.airtable-view-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: var(--background-primary);
    overflow-y: auto;
}
.record-header-simple {
    padding: var(--size-4-4) var(--size-4-4) var(--size-4-2);
}
.record-header-simple h2 {
    margin: 0;
    font-size: var(--font-ui-large);
}
.record-details {
    padding: 0 var(--size-4-4) var(--size-4-4);
}
.empty-container {
    padding: var(--size-4-4);
}
</style>
