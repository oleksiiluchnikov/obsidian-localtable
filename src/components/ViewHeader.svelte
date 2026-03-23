<script lang="ts">
	import Icon from "../ui/Icon.svelte";
	import { airtableStore } from "../features/airtable";

	let {
		title,
		icon = "database",
		lastRefresh = null,
		isCached = false,
	}: {
		title: string;
		icon?: string;
		lastRefresh?: number | null;
		isCached?: boolean;
	} = $props();

	let showRefreshMenu = $state(false);

	function formatTimeSince(timestamp: number | null): string {
		if (!timestamp) return "Never";
		const seconds = Math.floor((Date.now() - timestamp) / 1000);
		if (seconds < 60) return `${seconds}s ago`;
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		return `${hours}h ago`;
	}

	function handleRefresh() {
		airtableStore.loadTableInfo(false);
		showRefreshMenu = false;
	}

	function handleForceRefresh() {
		// refreshAll doesn't exist — force-refresh schema then records
		airtableStore.loadTableInfo(true);
		airtableStore.fetchRecords(true);
		showRefreshMenu = false;
	}

	function handleClearCache() {
		airtableStore.clearCache();
		airtableStore.loadTableInfo(true);
		showRefreshMenu = false;
	}
</script>

<div class="view-header">
	<div class="view-header-title-container">
		<Icon icon={icon} className="view-header-icon" />
		<div class="view-header-info">
			<div class="view-header-title">{title}</div>
			{#if lastRefresh}
				<div class="view-header-subtitle">
					{isCached ? "📦 Cached" : "✨ Fresh"} · {formatTimeSince(lastRefresh)}
				</div>
			{/if}
		</div>
	</div>
	<div class="view-actions">
		<div class="refresh-menu-container">
			<button
				class="clickable-icon"
				aria-label="Refresh"
				onclick={() => showRefreshMenu = !showRefreshMenu}
			>
				<Icon icon="refresh-cw" />
			</button>

			{#if showRefreshMenu}
				<div class="refresh-menu">
					<button class="refresh-menu-item" onclick={handleRefresh}>
						<Icon icon="refresh-cw" />
						<span>Refresh</span>
					</button>
					<button class="refresh-menu-item" onclick={handleForceRefresh}>
						<Icon icon="zap" />
						<span>Force Refresh</span>
					</button>
					<button class="refresh-menu-item" onclick={handleClearCache}>
						<Icon icon="trash-2" />
						<span>Clear Cache</span>
					</button>
				</div>
			{/if}
		</div>
	</div>
</div>

<style>
	.view-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--size-4-4) var(--size-4-6);
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.view-header-title-container {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
	}

	.view-header-info {
		display: flex;
		flex-direction: column;
		gap: var(--size-2-1);
	}

	:global(.view-header-icon) {
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.view-header-title {
		font-weight: var(--font-semibold);
		color: var(--text-normal);
	}

	.view-header-subtitle {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
	}

	.view-actions {
		display: flex;
		gap: var(--size-2-2);
	}

	.refresh-menu-container {
		position: relative;
	}

	.clickable-icon {
		background: transparent;
		border: none;
		cursor: pointer;
		padding: var(--size-2-2);
		border-radius: var(--radius-s);
		color: var(--text-muted);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.clickable-icon:hover {
		background-color: var(--background-modifier-hover);
		color: var(--text-normal);
	}

	.refresh-menu {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		background-color: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-m);
		box-shadow: var(--shadow-s);
		padding: var(--size-2-2);
		min-width: 180px;
		z-index: 100;
	}

	.refresh-menu-item {
		display: flex;
		align-items: center;
		gap: var(--size-2-2);
		width: 100%;
		padding: var(--size-2-2) var(--size-2-3);
		background: transparent;
		border: none;
		border-radius: var(--radius-s);
		cursor: pointer;
		color: var(--text-normal);
		font-size: var(--font-ui-small);
		text-align: left;
	}

	.refresh-menu-item:hover {
		background-color: var(--background-modifier-hover);
	}
</style>
