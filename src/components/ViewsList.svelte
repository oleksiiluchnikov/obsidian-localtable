<script lang="ts">
	import CollapsibleSection from "./CollapsibleSection.svelte";
	import ViewItem from "./ViewItem.svelte";

	let {
		views,
		expanded = false,
		onToggle,
	}: {
		views: Array<{
			name: string;
			type: string;
		}>;
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
				<ViewItem {view} />
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
