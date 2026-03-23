<script lang="ts">
	import Icon from "../ui/Icon.svelte";
	import StatCard from "../ui/StatCard.svelte";
	import { airtableStore } from "../features/airtable";
	import { onMount } from "svelte";

	let {
		data,
		loading = false,
		isCached = false,
		mode = "table",
		activeViewName = null,
		searchQuery = "",
		sortDirection = "asc",
	}: {
		data: any;
		loading?: boolean;
		isCached?: boolean;
		mode?: "table" | "view";
		activeViewName?: string | null;
		searchQuery?: string;
		sortDirection?: "asc" | "desc";
	} = $props();

	let fieldsCount  = $derived(data?.fields?.length  || 0);
	let viewsCount   = $derived(data?.views?.length   || 0);
	let recordsCount = $derived(data?.records?.length || 0);
	let hasRecords   = $derived(data?.records !== undefined);

	onMount(async () => {
		if (!hasRecords) {
			await airtableStore.fetchRecords(false);
		}
	});

	let searchTimeoutId = $state<number | null>(null);

	function handleSearchInput(event: Event) {
		const target = event.currentTarget;
		if (!(target instanceof HTMLInputElement)) return;

		if (searchTimeoutId !== null) {
			window.clearTimeout(searchTimeoutId);
		}

		searchTimeoutId = window.setTimeout(() => {
			void airtableStore.setRecordSearchQuery(target.value);
		}, 200);
	}

	async function batchSyncLinks() {
		await airtableStore.batchSyncLinks();
	}
</script>

<div class="table-overview">
	<div class="table-header-card">
		<Icon icon="table-2" className="table-icon" />
		<div class="table-title-container">
			{#if mode === "view"}
				<div class="mode-badge">View</div>
			{/if}
			<h2 class="table-title">{data.name}</h2>
			{#if mode === "view" && activeViewName}
				<div class="active-view-name">{activeViewName}</div>
			{/if}
			{#if data.description}
				<div class="table-description">{data.description}</div>
			{/if}
		</div>
	</div>

	<div class="stats-grid">
		<StatCard icon="columns" value={fieldsCount} label="Fields" />
		<StatCard icon="layout-grid" value={viewsCount} label="Views" />
		{#if hasRecords}
			<StatCard icon="database" value={recordsCount} label="Records" />
		{/if}
	</div>

	<div class="table-controls">
		<label class="search-control">
			<span class="search-label">Search records</span>
			<input
				class="search-input"
				type="search"
				value={searchQuery}
				oninput={handleSearchInput}
				placeholder="Search loaded records"
				aria-label="Search records"
			/>
		</label>

		<button
			class="sort-toggle-btn"
			type="button"
			onclick={() => airtableStore.toggleRecordSortDirection()}
			aria-label="Toggle record sort direction"
			title="Sort by primary field"
		>
			<Icon icon={sortDirection === "asc" ? "arrow-up-a-z" : "arrow-down-z-a"} />
			Sort {sortDirection === "asc" ? "A-Z" : "Z-A"}
		</button>
	</div>

	<button
		class="refresh-records-btn"
		onclick={() => airtableStore.fetchRecords(true)}
		disabled={loading}
	>
		<Icon icon="refresh-cw" />
		{loading ? "Refreshing..." : "Refresh Records"}
	</button>

	<button
		class="sync-all-btn"
		onclick={batchSyncLinks}
		disabled={loading || !hasRecords}
		title="Sync Obsidian links for all records with notes"
	>
		<Icon icon="link" />
		Sync All Links
	</button>
</div>

<style>
	.table-overview {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-3);
		margin-bottom: var(--size-4-4);
	}

	.table-header-card {
		display: flex;
		gap: var(--size-4-3);
		padding: var(--size-4-4);
		background-color: var(--background-secondary);
		border-radius: var(--radius-m);
		border: 1px solid var(--background-modifier-border);
	}

	:global(.table-icon) {
		color: var(--text-accent);
		flex-shrink: 0;
	}

	.table-title-container {
		flex: 1;
	}

	.mode-badge {
		display: inline-flex;
		align-items: center;
		margin-bottom: var(--size-2-1);
		padding: 0 var(--size-2-2);
		min-height: 22px;
		border-radius: var(--radius-s);
		background-color: var(--background-modifier-hover);
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
		font-weight: var(--font-medium);
	}

	.table-title {
		margin: 0;
		font-size: var(--font-ui-large);
		font-weight: var(--font-semibold);
		color: var(--text-normal);
	}

	.table-description {
		margin-top: var(--size-2-2);
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}

	.active-view-name {
		margin-top: var(--size-2-1);
		font-size: var(--font-ui-small);
		color: var(--text-accent);
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: var(--size-4-2);
	}

	.table-controls {
		display: flex;
		flex-wrap: wrap;
		gap: var(--size-4-2);
	}

	.search-control {
		display: flex;
		flex: 1 1 220px;
		flex-direction: column;
		gap: var(--size-2-1);
	}

	.search-label {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
	}

	.search-input {
		width: 100%;
		min-height: 36px;
		padding: 0 var(--size-4-3);
		background-color: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		color: var(--text-normal);
	}

	.search-input:focus-visible {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	.sort-toggle-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--size-2-2);
		min-height: 36px;
		padding: var(--size-2-3) var(--size-4-4);
		background-color: var(--interactive-normal);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		color: var(--text-normal);
		cursor: pointer;
	}

	.sort-toggle-btn:hover {
		background-color: var(--interactive-hover);
	}

	.refresh-records-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--size-2-2);
		padding: var(--size-2-3) var(--size-4-4);
		background-color: var(--interactive-normal);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		color: var(--text-normal);
		cursor: pointer;
	}

	.refresh-records-btn:hover:not(:disabled) {
		background-color: var(--interactive-hover);
	}

	.refresh-records-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
