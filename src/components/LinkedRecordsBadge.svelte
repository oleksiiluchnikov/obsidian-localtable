<script lang="ts">
	import { onMount } from "svelte";
	import Icon from "../ui/Icon.svelte";
	import { airtableStore, type LinkedRecordInfo } from "../features/airtable";

	let {
		record,
		size = "small",
	}: {
		record: LinkedRecordInfo;
		size?: "small" | "medium";
	} = $props();

	let fileExists = $state(false);
	let checking = $state(true);
	let baseId = $state("");

	onMount(async () => {
		const status = await airtableStore.checkNoteStatus(record.id);
		fileExists = status.exists;
		baseId = status.baseId;
		checking = false;
	});

	function handleOpenAirtable(e: MouseEvent) {
		e.stopPropagation();
		if (!baseId) return;
		const url = `https://airtable.com/${baseId}/${record.tableId}/${record.id}`;
		window.open(url, "_blank");
	}

	async function handleNoteAction(e: MouseEvent) {
		e.stopPropagation();
		if (fileExists) {
			airtableStore.openNote(record.id);
		} else {
			await airtableStore.createNote({
				id: record.id,
				fields: { Name: record.name },
				createdTime: "",
			});
			fileExists = true;
		}
	}
</script>

<!-- Compact linked-record control with a primary Airtable action and a note action. -->
<div
	class="linked-record-badge"
	class:linked-record-badge--sm={size === "small"}
	class:linked-record-badge--faded={!fileExists && !checking}
	role="group"
	aria-label="Linked record: {record.name}"
>
	<button
		class="linked-record-badge__main"
		onclick={handleOpenAirtable}
		type="button"
		title="Open in Airtable"
	>
		<span class="linked-record-badge__label">{record.name}</span>
	</button>

	<div class="linked-record-badge__divider" aria-hidden="true"></div>

	<button
		class="linked-record-badge__action"
		class:linked-record-badge__action--exists={fileExists}
		onclick={handleNoteAction}
		type="button"
		title={fileExists ? "Open note" : "Create note"}
		aria-label={fileExists ? "Open note" : "Create note"}
	>
		{#if checking}
			<span class="linked-record-badge__spinner"></span>
		{:else}
			<Icon
				icon={fileExists ? "file-text" : "file-plus"}
				className="linked-record-badge__icon"
			/>
		{/if}
	</button>
</div>

<style>
	.linked-record-badge {
		display: inline-flex;
		align-items: stretch;
		flex-shrink: 0;
		vertical-align: middle;

		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		overflow: hidden;

		font-family: var(--font-interface);
		font-weight: 500;
		white-space: nowrap;
		color: var(--text-normal);

		transition:
			opacity 150ms ease,
			border-color 100ms ease;
	}

	.linked-record-badge:hover {
		border-color: var(--background-modifier-border-hover, var(--text-faint));
	}

	.linked-record-badge--faded {
		opacity: 0.45;
	}
	.linked-record-badge--faded:hover {
		opacity: 0.85;
	}

	.linked-record-badge__main,
	.linked-record-badge__action {
		display: inline-flex;
		align-items: center;
		justify-content: center;

		background: transparent;
		border: none;
		cursor: pointer;
		font-family: inherit;
		font-weight: inherit;
		color: inherit;
		line-height: 1;

		transition:
			background 100ms ease,
			color 100ms ease;
	}

	.linked-record-badge__main:hover,
	.linked-record-badge__action:hover {
		background: var(--background-modifier-hover);
	}

	.linked-record-badge__main {
		padding: 2px var(--size-2-2);
		font-size: var(--font-ui-smaller);
		color: var(--text-normal);
	}

	.linked-record-badge__main:hover {
		color: var(--text-accent);
	}

	.linked-record-badge:not(.linked-record-badge--sm) .linked-record-badge__main {
		padding: var(--size-2-1) var(--size-2-3);
		font-size: var(--font-ui-small);
	}

	.linked-record-badge__label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
		max-width: 140px;
	}

	.linked-record-badge:not(.linked-record-badge--sm) .linked-record-badge__label {
		max-width: 180px;
	}

	.linked-record-badge__divider {
		width: 1px;
		background: var(--background-modifier-border);
		flex-shrink: 0;
		align-self: stretch;
	}

	.linked-record-badge__action {
		padding: 2px var(--size-2-1);
		color: var(--text-faint);
	}

	.linked-record-badge__action:hover {
		color: var(--text-muted);
	}

	.linked-record-badge__action--exists {
		color: var(--interactive-accent);
	}

	.linked-record-badge__action--exists:hover {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	:global(.linked-record-badge__icon),
	:global(.linked-record-badge__icon svg) {
		width: 11px;
		height: 11px;
		display: block;
		overflow: visible;
	}

	.linked-record-badge:not(.linked-record-badge--sm) :global(.linked-record-badge__icon),
	.linked-record-badge:not(.linked-record-badge--sm) :global(.linked-record-badge__icon svg) {
		width: 13px;
		height: 13px;
	}

	.linked-record-badge__spinner {
		display: block;
		width: 7px;
		height: 7px;
		border: 1px solid var(--text-faint);
		border-top-color: transparent;
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}
</style>
