<script lang="ts">
	import Icon from "../ui/Icon.svelte";
	import FieldValue from "./FieldValue.svelte";
	import AirtableLinkButton from "./AirtableLinkButton.svelte";
	import { getFieldTypeIcon } from "../utils/iconMapping";
	import type { Field, ResolvedValue } from "../features/airtable";
	let {
		title = "Properties",
		fields,
		expanded = $bindable(true),
	}: {
		title?: string;
		fields: Array<{ name: string; resolved: ResolvedValue; field?: Field }>;
		expanded?: boolean;
	} = $props();

	function toggle() {
		expanded = !expanded;
	}
</script>

<div class="properties-section">
	<div class="section-header">
		<button class="section-toggle" type="button" aria-expanded={expanded} onclick={toggle}>
			<span class="section-title">{title}</span>
			<div class="header-line"></div>
			<Icon icon={expanded ? "chevron-down" : "chevron-right"} className="header-icon" />
		</button>

		<div class="header-actions">
			<AirtableLinkButton size="small" />
		</div>
	</div>

	{#if expanded}
		<div class="properties-grid">
			{#each fields as { name, resolved, field }}
				<!-- Skip empty values if desired, or keep to show structure -->
				<div class="property-row">
					<div class="property-label" title={name}>
						<Icon icon={getFieldTypeIcon(field?.type || 'text')} className="property-icon" />
						<span class="label-text">{name}</span>
					</div>
					<div class="property-value">
						<FieldValue value={resolved} />
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.properties-section {
		margin-bottom: var(--size-4-2);
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
		margin-bottom: var(--size-2-2);
	}

	.section-toggle {
		appearance: none;
		background: none;
		border: none;
		display: flex;
		align-items: center;
		gap: var(--size-4-2);
		padding: var(--size-2-2) 0;
		cursor: pointer;
		user-select: none;
		margin: 0;
		width: 100%;
		text-align: left;
		padding: var(--size-2-2) 0;
	}

	.section-title {
		font-size: var(--font-ui-small);
		font-weight: var(--font-semibold);
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		white-space: nowrap;
	}

	.header-line {
		flex: 1;
		height: 1px;
		background-color: var(--background-modifier-border);
	}

	:global(.header-icon) {
		color: var(--text-faint);
		width: 14px;
		height: 14px;
	}

	.section-toggle:hover .section-title,
	.section-toggle:hover :global(.header-icon),
	.section-toggle:focus-visible .section-title,
	.section-toggle:focus-visible :global(.header-icon) {
		color: var(--text-normal);
	}

	.section-toggle:focus-visible {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 2px;
	}

	/* The Layout Grid — 2-column: label | value, matching Obsidian's properties panel */
	.properties-grid {
		display: grid;
		grid-template-columns: fit-content(200px) 1fr;
		row-gap: 0;
		column-gap: var(--size-4-2);
		font-size: var(--font-ui-small);
	}

	.property-row {
		display: contents; /* children participate directly in the 2-col grid */
	}

	/* Row separator — since .property-row uses display:contents its children
	   are direct grid items. Apply border to every cell; the last two cells
	   (last label + last value) have it removed via :last-child on the grid. */
	.property-label,
	.property-value {
		border-bottom: 1px solid var(--background-modifier-border);
	}

	/* Remove border from the last row. With display:contents the last grid
	   item is .property-value of the last row, preceded by its .property-label.
	   Use :last-child and :nth-last-child(2) on the grid container's children. */
	.properties-grid > :last-child,
	.properties-grid > :nth-last-child(2) {
		border-bottom: none;
	}

	.property-label {
		display: flex;
		align-items: flex-start;
		gap: var(--size-2-2);
		color: var(--text-muted);
		overflow: hidden;
		padding-top: var(--size-2-3);
		padding-bottom: var(--size-2-3);
	}

	:global(.property-icon) {
		width: 14px;
		height: 14px;
		margin-top: 1px;
		opacity: 0.5;
		flex-shrink: 0;
	}

	.label-text {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.property-value {
		color: var(--text-normal);
		min-width: 0;
		padding-top: var(--size-2-3);
		padding-bottom: var(--size-2-3);
		display: flex;
		align-items: flex-start;
		flex-wrap: wrap;
		gap: var(--size-2-2);
	}

</style>
