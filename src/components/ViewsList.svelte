<script lang="ts">
	import CollapsibleSection from "./CollapsibleSection.svelte";
	import ViewItem from "./ViewItem.svelte";

	let {
		views,
		currentViewId = null,
		expanded = false,
		onToggle,
	}: {
		views: Array<{
			id: string;
			name: string;
			type: string;
		}>;
		currentViewId?: string | null;
		expanded?: boolean;
		onToggle: () => void;
	} = $props();
</script>

{#if views && views.length > 0}
	<CollapsibleSection 
		title="Views" 
		{expanded} 
		count={views.length}
		{onToggle}
	>
		<div class="view-list">
			{#each views as view (view.name)}
				<ViewItem {view} isActive={view.id === currentViewId} />
			{/each}
		</div>
	</CollapsibleSection>
{/if}

<style>
	.view-list {
		display: flex;
		flex-direction: column;
	}
</style>
