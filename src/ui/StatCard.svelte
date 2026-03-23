<script lang="ts">
	import Icon from "./Icon.svelte";

	let {
		icon,
		value,
		label,
	}: {
		icon: string;
		value: string | number;
		label: string;
	} = $props();
</script>

<div class="stat-item">
	<Icon icon={icon} className="stat-icon" />
	<div class="stat-content">
		<div class="stat-value">{value}</div>
		<div class="stat-label">{label}</div>
	</div>
</div>

<style>
	.stat-item {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
		padding: var(--size-4-3);
		background-color: var(--background-secondary);
		border-radius: var(--radius-m);
		border: 1px solid var(--background-modifier-border);
	}

	:global(.stat-icon) {
		color: var(--text-accent);
		flex-shrink: 0;
	}

	.stat-content {
		display: flex;
		flex-direction: column;
	}

	.stat-value {
		font-size: var(--font-ui-large);
		font-weight: var(--font-semibold);
		color: var(--text-normal);
		line-height: 1.2;
	}

	.stat-label {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
	}
</style>
