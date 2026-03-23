<script lang="ts">
	import CollapsibleSection from "./CollapsibleSection.svelte";
	import FieldItem from "./FieldItem.svelte";

	let {
		fields,
		primaryFieldId,
		expanded = false,
		onToggle,
	}: {
		fields: Array<{
			id: string;
			name: string;
			type: string;
			description?: string;
		}>;
		primaryFieldId: string;
		expanded?: boolean;
		onToggle: () => void;
	} = $props();
</script>

<CollapsibleSection
	title="Fields"
	count={fields.length}
	{expanded}
	{onToggle}
>
	<div class="field-list">
		{#each fields as field (field.id)}
			<FieldItem {field} isPrimary={field.id === primaryFieldId} />
		{/each}
	</div>
</CollapsibleSection>

<style>
	.field-list {
		display: flex;
		flex-direction: column;
	}
</style>
