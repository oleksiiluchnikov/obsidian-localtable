<script lang="ts">
	import Icon from "../ui/Icon.svelte";

	let { view }: {
		view: {
			name: string;
			type: string;
		};
	} = $props();
</script>

<div class="view-item">
	<Icon icon={view.type === "grid" ? "table" : "layout"} className="view-icon" />
	<div class="view-info">
		<div class="view-name">{view.name}</div>
		<div class="view-type">{view.type}</div>
	</div>
</div>

<style>
	.view-item {
		display: flex;
		gap: var(--size-4-2);
		padding: var(--size-4-3);
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.view-item:last-child {
		border-bottom: none;
	}

	:global(.view-icon) {
		color: var(--text-muted);
		flex-shrink: 0;
		margin-top: 2px;
	}

	.view-info {
		flex: 1;
	}

	.view-name {
		font-weight: var(--font-medium);
		color: var(--text-normal);
		margin-bottom: var(--size-2-1);
	}

	.view-type {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		text-transform: capitalize;
	}
</style>
