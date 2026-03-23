<script lang="ts">
	import type { Snippet } from "svelte";
	import Icon from "../ui/Icon.svelte";
	import Badge from "../ui/Badge.svelte";

	let { title, expanded = true, count = null, onToggle, children }: {
		title: string;
		expanded?: boolean;
		count?: number | null;
		onToggle: () => void;
		children?: Snippet;
	} = $props();
</script>

<div class="section">
	<button
		class="section-header"
		class:is-collapsed={!expanded}
		onclick={onToggle}
	>
		<Icon icon={expanded ? "chevron-down" : "chevron-right"} className="section-header-icon" />
		<div class="section-title">{title}</div>
		{#if count !== null}
			<Badge variant="default" size="medium">{count}</Badge>
		{/if}
	</button>

	{#if expanded}
		<div class="section-content">
			{@render children?.()}
		</div>
	{/if}
</div>

<style>
	.section {
		margin-bottom: var(--size-4-3);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		overflow: hidden;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
		width: 100%;
		padding: var(--size-4-3);
		background-color: var(--background-secondary);
		border: none;
		cursor: pointer;
		text-align: left;
		transition: background-color 0.1s;
	}

	.section-header:hover {
		background-color: var(--background-modifier-hover);
	}

	:global(.section-header-icon) {
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.section-title {
		flex: 1;
		font-weight: var(--font-medium);
		color: var(--text-normal);
	}

	.section-content {
		background-color: var(--background-primary);
	}
</style>
