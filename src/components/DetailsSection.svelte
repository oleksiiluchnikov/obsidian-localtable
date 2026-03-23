<script lang="ts">
	import CollapsibleSection from "./CollapsibleSection.svelte";

	let {
		tableId,
		primaryFieldName,
		expanded = false,
		onToggle,
	}: {
		tableId: string;
		primaryFieldName: string;
		expanded?: boolean;
		onToggle: () => void;
	} = $props();
</script>

<CollapsibleSection
	title="Details"
	{expanded}
	{onToggle}
>
	<div class="details-grid">
		<div class="detail-item">
			<div class="detail-label">Table ID</div>
			<div class="detail-value detail-mono">{tableId}</div>
		</div>
		<div class="detail-item">
			<div class="detail-label">Primary Field</div>
			<div class="detail-value">{primaryFieldName}</div>
		</div>
	</div>
</CollapsibleSection>

<style>
	.details-grid {
		padding: var(--size-4-3);
		display: flex;
		flex-direction: column;
		gap: var(--size-4-2);
	}

	.detail-item {
		display: flex;
		flex-direction: column;
		gap: var(--size-2-1);
	}

	.detail-label {
		font-size: var(--font-ui-smaller);
		font-weight: var(--font-medium);
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.detail-value {
		font-size: var(--font-ui-small);
		color: var(--text-normal);
	}

	.detail-mono {
		font-family: var(--font-monospace);
		font-size: var(--font-ui-smaller);
		background-color: var(--background-primary-alt);
		padding: var(--size-2-2) var(--size-2-3);
		border-radius: var(--radius-s);
		word-break: break-all;
	}
</style>
