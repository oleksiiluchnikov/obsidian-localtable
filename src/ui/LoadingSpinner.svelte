<script lang="ts">
	import Icon from "./Icon.svelte";

	let {
		message = "Loading...",
	}: {
		message?: string;
	} = $props();
</script>

<div class="loading-container">
	<div class="loading-spinner">
		<Icon icon="loader-2" />
	</div>
	<div class="loading-text">{message}</div>
</div>

<style>
	.loading-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--size-4-2);
		padding: var(--size-4-8);
		color: var(--text-muted);
	}

	.loading-spinner {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.loading-text {
		font-size: var(--font-ui-small);
	}
</style>
