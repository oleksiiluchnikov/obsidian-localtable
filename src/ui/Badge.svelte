<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		variant = "default",
		size = "small",
		children,
	}: {
		variant?: "default" | "primary" | "accent";
		size?: "small" | "medium";
		children?: Snippet;
	} = $props();
</script>

<span class="badge" class:badge-primary={variant === "primary"} class:badge-accent={variant === "accent"} class:badge-medium={size === "medium"}>
	{@render children?.()}
</span>

<style>
	.badge {
		padding: 1px 6px;
		background-color: var(--background-modifier-border);
		border-radius: var(--radius-s);
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		font-weight: var(--font-medium);
		display: inline-block;
	}

	.badge-medium {
		padding: var(--size-2-1) var(--size-4-2);
	}

	.badge-primary {
		background-color: var(--text-accent);
		color: var(--text-on-accent);
	}

	.badge-accent {
		background-color: var(--interactive-accent);
		color: var(--text-on-accent);
	}
</style>
