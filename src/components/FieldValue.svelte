<script lang="ts">
	import Icon from "../ui/Icon.svelte";
	import Badge from "../ui/Badge.svelte";
	import LinkedRecordsBadge from "./LinkedRecordsBadge.svelte";
	import type { ResolvedValue } from "../features/airtable";

	let {
		value,
	}: {
		value: ResolvedValue;
	} = $props();

	// Helper for rating stars
	const MAX_RATING = 5;
</script>

{#if value.type === "attachment" && value.rawValue}
	<div class="thumbs">
		{#each value.rawValue.slice(0, 5) as att}
			{#if att.thumbnails?.small}
				<a href={att.url} target="_blank" rel="noopener noreferrer" class="thumb" title={att.filename}>
					<img src={att.thumbnails.small.url} alt={att.filename} />
				</a>
			{:else}
				<a href={att.url} target="_blank" rel="noopener noreferrer" class="thumb-file" title={att.filename}>
					<Icon icon="file" className="icon-tiny" />
				</a>
			{/if}
		{/each}
		{#if value.rawValue.length > 5}
			<span class="more-count">+{value.rawValue.length - 5}</span>
		{/if}
	</div>

{:else if value.type === "rating"}
	<div class="rating-stars" title={`${value.rawValue}/${MAX_RATING}`}>
		{#each Array(MAX_RATING) as _, i}
			<Icon
				icon="star"
				className={`star-icon ${i < (Number(value.rawValue) || 0) ? 'filled' : 'empty'}`}
			/>
		{/each}
	</div>

{:else if value.type === "linkedRecords" && value.metadata?.linkedRecords}
	<div class="links-list">
		{#each value.metadata.linkedRecords as link}
			<LinkedRecordsBadge record={link} size="small" />
		{/each}
	</div>

{:else if value.type === "multipleSelects" || value.type === "singleSelect"}
	<div class="tags-list">
		{#each (Array.isArray(value.rawValue) ? value.rawValue : [value.displayValue]) as tag}
			{#if tag}
				<Badge variant="accent" size="small">{tag}</Badge>
			{/if}
		{/each}
	</div>

{:else if value.type === "checkbox"}
	<div class="checkbox-val" class:is-checked={value.rawValue}>
		<Icon icon={value.rawValue ? "check-square" : "square"} className="icon-small" />
	</div>

{:else if value.type === "url" && value.rawValue}
<a href={value.rawValue} target="_blank" rel="noopener noreferrer" class="link">
		{value.displayValue}
		<Icon icon="external-link" className="icon-tiny" />
	</a>

{:else}
	<span class="text-val">{value.displayValue}</span>
{/if}

<style>
	.thumbs { display: flex; gap: var(--size-2-2); flex-wrap: wrap; }
	.thumb { width: 24px; height: 24px; border-radius: var(--radius-s); overflow: hidden; border: 1px solid var(--background-modifier-border); display: block; }
	.thumb img { width: 100%; height: 100%; object-fit: cover; }
	.thumb-file { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: var(--background-secondary); border-radius: var(--radius-s); }

	.rating-stars { display: flex; gap: var(--size-2-1); align-items: center; }
	:global(.star-icon) { width: 12px; height: 12px; }
	:global(.star-icon.filled) { fill: var(--text-accent); color: var(--text-accent); }
	:global(.star-icon.empty) { color: var(--text-faint); }

	.links-list, .tags-list { display: flex; flex-wrap: wrap; gap: var(--size-2-2); }

	.link { color: var(--text-accent); text-decoration: none; display: inline-flex; align-items: center; gap: var(--size-2-2); }
	.link:hover { text-decoration: underline; }

	.checkbox-val { display: flex; align-items: center; color: var(--text-muted); }
	.checkbox-val.is-checked { color: var(--text-accent); }

	.text-val { white-space: pre-wrap; word-break: break-word; line-height: 1.4; }

	:global(.icon-tiny) { width: 11px; height: 11px; opacity: 0.6; }
	:global(.icon-small) { width: 14px; height: 14px; }
	.more-count { font-size: var(--font-ui-smaller); color: var(--text-muted); align-self: center; }
</style>
