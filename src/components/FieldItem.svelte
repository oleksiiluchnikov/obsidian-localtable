<script lang="ts">
	import Icon from "../ui/Icon.svelte";
	import Badge from "../ui/Badge.svelte";
	import { getFieldTypeIcon } from "../utils/iconMapping";

	let { field, isPrimary = false }: {
		field: {
			id: string;
			name: string;
			type: string;
			description?: string;
		};
		isPrimary?: boolean;
	} = $props();
</script>

<div class="field-item" class:is-primary={isPrimary}>
	<Icon icon={getFieldTypeIcon(field.type)} className="field-icon" />
	<div class="field-info">
		<div class="field-name">
			{field.name}
			{#if isPrimary}
				<Badge variant="primary">Primary</Badge>
			{/if}
		</div>
		<div class="field-type">{field.type}</div>
		{#if field.description}
			<div class="field-description">{field.description}</div>
		{/if}
	</div>
</div>

<style>
	.field-item {
		display: flex;
		gap: var(--size-4-2);
		padding: var(--size-4-3);
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.field-item:last-child {
		border-bottom: none;
	}

	.field-item.is-primary {
		background-color: var(--background-secondary);
	}

	:global(.field-icon) {
		color: var(--text-muted);
		flex-shrink: 0;
		margin-top: 2px;
	}

	.field-info {
		flex: 1;
		min-width: 0;
	}

	.field-name {
		display: flex;
		align-items: center;
		gap: var(--size-2-2);
		font-weight: var(--font-medium);
		color: var(--text-normal);
		margin-bottom: var(--size-2-1);
	}

	.field-type {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		font-family: var(--font-monospace);
	}

	.field-description {
		margin-top: var(--size-2-2);
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}
</style>
