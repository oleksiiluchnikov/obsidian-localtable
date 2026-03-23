<script lang="ts">
	import CollapsibleSection from "./CollapsibleSection.svelte";
	import RecordItem from "./RecordItem.svelte";
	import { FieldResolver, type TableData } from "../features/airtable";
	import type { AirtableRecord } from "../airtable";

	let {
		records,
		tableData,
		expanded = true,
		onToggle,
		onRecordClick = null,
	}: {
		records: AirtableRecord[];
		tableData: TableData;
		expanded?: boolean;
		onToggle: () => void;
		onRecordClick?: ((record: AirtableRecord) => void) | null;
	} = $props();

	// Reactive resolver creation
	let resolver = $derived(new FieldResolver(tableData));
</script>

<CollapsibleSection
	title={`Records (${records.length})`}
	{expanded}
	count={records.length}
	{onToggle}
>
	<div class="records-container">
		{#if records.length > 0}
		<div class="records-list">
				{#each records as record (record.id)}
					<RecordItem {record} {resolver} maxFields={6} onClick={onRecordClick} />
				{/each}
			</div>
		{:else}
			<div class="empty-records">No records found</div>
		{/if}
	</div>
</CollapsibleSection>

<style>
	.records-container { padding: var(--size-4-3); }
	.records-list { display: flex; flex-direction: column; gap: var(--size-4-2); }
	.empty-records { padding: var(--size-4-4); text-align: center; color: var(--text-muted); }
</style>
