<script lang="ts">
	import Icon from "./Icon.svelte";

	let {
		icon = "file-question",
		title,
		description = "",
		actionLabel = "",
		onAction = null,
	}: {
		icon?: string;
		title: string;
		description?: string;
		actionLabel?: string;
		onAction?: (() => void) | null;
	} = $props();
</script>

<div class="empty-state">
	<Icon icon={icon} className="empty-state-icon" />
	<div class="empty-state-title">{title}</div>
	{#if description}
		<div class="empty-state-description">{@html description}</div>
	{/if}
	{#if actionLabel && onAction}
		<button class="mod-cta" onclick={onAction}>
			{actionLabel}
		</button>
	{/if}
</div>

<style>
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--size-4-2);
		padding: var(--size-4-12);
		text-align: center;
	}

	:global(.empty-state-icon) {
		color: var(--text-faint);
		width: 48px;
		height: 48px;
	}

	.empty-state-title {
		font-size: var(--font-ui-medium);
		font-weight: var(--font-semibold);
		color: var(--text-muted);
	}

	.empty-state-description {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
		max-width: 300px;
	}

	.empty-state-description :global(code) {
		background-color: var(--background-primary-alt);
		padding: 2px 6px;
		border-radius: var(--radius-s);
		font-family: var(--font-monospace);
		font-size: 0.9em;
	}

	button.mod-cta {
		margin-top: var(--size-4-2);
	}
</style>
