<script lang="ts">
	import Icon from "../ui/Icon.svelte";
	import StatCard from "../ui/StatCard.svelte";
	import { airtableStore } from "../features/airtable";
	import { onMount } from "svelte";

	let {
		data,
		loading = false,
		isCached = false,
	}: {
		data: any;
		loading?: boolean;
		isCached?: boolean;
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

	async function batchSyncLinks() {
		await airtableStore.batchSyncLinks();
	}
</script>

<div class="table-overview">
	<div class="table-header-card">
		<Icon icon="table-2" className="table-icon" />
		<div class="table-title-container">
			<h2 class="table-title">{data.name}</h2>
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

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: var(--size-4-2);
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
