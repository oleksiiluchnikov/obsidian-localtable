<script lang="ts">
	import Icon from "../ui/Icon.svelte";
	import Badge from "../ui/Badge.svelte";
	import LinkedRecordBadge from "./LinkedRecordsBadge.svelte";
	import type { AirtableRecord } from "../airtable";
	import { FieldResolver, airtableStore } from "../features/airtable";
	import { getFieldTypeIcon } from "../utils/iconMapping";

	let { record, resolver, maxFields = 8, onClick = null }: {
		record: AirtableRecord;
		resolver: FieldResolver;
		maxFields?: number;
		onClick?: ((record: AirtableRecord) => void) | null;
	} = $props();

	let resolvedFields = $derived(Object.entries(record.fields)
		.slice(0, maxFields)
		.map(([fieldName, value]) => {
			const field = resolver.getFieldByName(fieldName);
			return {
				name: fieldName,
				resolved: field ? resolver.resolve(field.id, value) : {
					type: "text",
					displayValue: String(value),
					rawValue: value
				},
				field
			};
		}));

	let primaryField = $derived(resolvedFields[0]);
	let otherFields = $derived(resolvedFields.slice(1));
	let hasMore = $derived(Object.keys(record.fields).length > maxFields);

	function handleClick() {
		if (onClick) {
			onClick(record);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			handleClick();
		}
	}

	function handleCreateNote(e: MouseEvent) {
		e.stopPropagation();
		airtableStore.createNote(record);
	}

</script>

{#if onClick}
	<div class="record record--interactive" role="button" tabindex="0" onclick={handleClick} onkeydown={handleKeydown}>
			<div class="record-title">
				<span class="title-text">
					{primaryField?.resolved.displayValue || record.id}
				</span>
				{#if hasMore}
					<span class="more">+{Object.keys(record.fields).length - maxFields}</span>
				{/if}
			</div>

			<div class="fields">
				{#each otherFields as { name, resolved, field }}
					<div class="field">
						<span class="label">
							{#if field}
								<Icon icon={getFieldTypeIcon(field.type)} className="icon-tiny" />
							{/if}
							{name}
						</span>

						<div class="value">
							{#if resolved.type === "attachment" && resolved.rawValue}
								<div class="thumbs">
									{#each resolved.rawValue.slice(0, 3) as att}
										{#if att.thumbnails?.small}
											<a href={att.url} target="_blank" rel="noopener noreferrer" class="thumb">
												<img src={att.thumbnails.small.url} alt={att.filename} />
											</a>
										{/if}
									{/each}
									{#if resolved.rawValue.length > 3}
										<span class="count">+{resolved.rawValue.length - 3}</span>
									{/if}
								</div>

							{:else if resolved.type === "linkedRecords" && resolved.metadata?.linkedRecords}
								<div class="links">
									{#each resolved.metadata.linkedRecords.slice(0, 2) as link}
										<LinkedRecordBadge record={link} size="small" />
									{/each}
									{#if resolved.metadata.linkedRecords.length > 2}
										<span class="count">+{resolved.metadata.linkedRecords.length - 2}</span>
									{/if}
								</div>

							{:else if resolved.type === "multipleSelects"}
								<div class="tags">
									{#each (resolved.rawValue || []).slice(0, 3) as tag}
										<Badge variant="accent" size="small">{tag}</Badge>
									{/each}
									{#if resolved.rawValue?.length > 3}
										<span class="count">+{resolved.rawValue.length - 3}</span>
									{/if}
								</div>

							{:else if resolved.type === "checkbox"}
								<span class="check">{resolved.rawValue ? "✓" : "—"}</span>

							{:else if resolved.type === "url" && resolved.rawValue}
								<a href={resolved.rawValue} target="_blank" rel="noopener noreferrer" class="link">
									{resolved.displayValue}
									<Icon icon="external-link" className="icon-tiny" />
								</a>

							{:else if resolved.type === "button"}
								{#if resolved.rawValue?.url}
									<a href={resolved.rawValue.url} target="_blank" rel="noopener noreferrer" class="link">
										{resolved.displayValue}
										<Icon icon="external-link" className="icon-tiny" />
									</a>
								{:else}
									<span>{resolved.displayValue}</span>
								{/if}

							{:else}
								<span>{resolved.displayValue}</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>

		<button class="create-note-btn" type="button" onclick={handleCreateNote} aria-label="Create note from record" title="Create note from record">
			<Icon icon="file-plus" className="icon-small" />
		</button>
	</div>
{:else}
	<div class="record">
		<div class="record-title">
			<span class="title-text">
				{primaryField?.resolved.displayValue || record.id}
			</span>
			{#if hasMore}
				<span class="more">+{Object.keys(record.fields).length - maxFields}</span>
			{/if}

			<button class="create-note-btn" type="button" onclick={handleCreateNote} aria-label="Create note from record" title="Create note from record">
				<Icon icon="file-plus" className="icon-small" />
			</button>
		</div>

		<div class="fields">
			{#each otherFields as { name, resolved, field }}
				<div class="field">
					<span class="label">
						{#if field}
							<Icon icon={getFieldTypeIcon(field.type)} className="icon-tiny" />
						{/if}
						{name}
					</span>

					<div class="value">
						{#if resolved.type === "attachment" && resolved.rawValue}
							<div class="thumbs">
								{#each resolved.rawValue.slice(0, 3) as att}
									{#if att.thumbnails?.small}
										<a href={att.url} target="_blank" rel="noopener noreferrer" class="thumb">
											<img src={att.thumbnails.small.url} alt={att.filename} />
										</a>
									{/if}
								{/each}
								{#if resolved.rawValue.length > 3}
									<span class="count">+{resolved.rawValue.length - 3}</span>
								{/if}
							</div>

						{:else if resolved.type === "linkedRecords" && resolved.metadata?.linkedRecords}
							<div class="links">
								{#each resolved.metadata.linkedRecords.slice(0, 2) as link}
									<LinkedRecordBadge record={link} size="small" />
								{/each}
								{#if resolved.metadata.linkedRecords.length > 2}
									<span class="count">+{resolved.metadata.linkedRecords.length - 2}</span>
								{/if}
							</div>

						{:else if resolved.type === "multipleSelects"}
							<div class="tags">
								{#each (resolved.rawValue || []).slice(0, 3) as tag}
									<Badge variant="accent" size="small">{tag}</Badge>
								{/each}
								{#if resolved.rawValue?.length > 3}
									<span class="count">+{resolved.rawValue.length - 3}</span>
								{/if}
							</div>

						{:else if resolved.type === "checkbox"}
							<span class="check">{resolved.rawValue ? "✓" : "—"}</span>

						{:else if resolved.type === "url" && resolved.rawValue}
							<a href={resolved.rawValue} target="_blank" rel="noopener noreferrer" class="link">
								{resolved.displayValue}
								<Icon icon="external-link" className="icon-tiny" />
							</a>

						{:else if resolved.type === "button"}
							{#if resolved.rawValue?.url}
								<a href={resolved.rawValue.url} target="_blank" rel="noopener noreferrer" class="link">
									{resolved.displayValue}
									<Icon icon="external-link" className="icon-tiny" />
								</a>
							{:else}
								<span>{resolved.displayValue}</span>
							{/if}

						{:else}
							<span>{resolved.displayValue}</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.record {
		position: relative;
		padding: var(--size-4-2) var(--size-4-3);
		background: var(--background-secondary);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		font-size: var(--font-ui-small);
		transition: all 0.15s;
	}

	.record--interactive {
		cursor: pointer;
	}

	.record:hover {
		border-color: var(--text-accent);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.record--interactive:hover {
		transform: translateY(-2px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
	}

	.record--interactive:active {
		transform: translateY(0);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	.record--interactive:focus-visible {
		outline: 2px solid var(--interactive-accent);
		outline-offset: 4px;
	}

	.record-title {
		font-weight: var(--font-semibold);
		margin-bottom: var(--size-2-2);
		display: flex;
		align-items: center;
		gap: var(--size-2-2);
		color: var(--text-normal);
	}

    .title-text {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

	.create-note-btn {
		background: transparent;
		border: none;
		padding: 4px;
		border-radius: var(--radius-s);
		cursor: pointer;
		display: flex;
		align-items: center;
		color: var(--text-muted);
		opacity: 0;
		transition: all 0.2s;
	}

	.record:hover .create-note-btn,
	.record:focus-within .create-note-btn {
		opacity: 1;
	}

	.record--interactive .create-note-btn {
		position: absolute;
		right: var(--size-4-3);
		top: var(--size-4-2);
	}

	.create-note-btn:hover,
	.create-note-btn:focus-visible {
		background-color: var(--interactive-accent);
		color: var(--text-on-accent);
		outline: none;
	}

	:global(.icon-small) {
		width: 14px;
		height: 14px;
	}

	.more {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		font-weight: normal;
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: var(--size-2-1);
	}

	.field {
		display: grid;
		grid-template-columns: 140px 1fr;
		gap: var(--size-2-2);
		align-items: start;
		font-size: var(--font-ui-smaller);
	}

	.label {
		color: var(--text-muted);
		display: flex;
		align-items: center;
		gap: var(--size-2-1);
		font-weight: var(--font-medium);
	}

	:global(.icon-tiny) {
		width: 11px;
		height: 11px;
		opacity: 0.6;
	}

	.value {
		color: var(--text-normal);
		min-width: 0;
		word-break: break-word;
	}

	/* Attachments */
	.thumbs {
		display: flex;
		gap: var(--size-2-1);
		align-items: center;
		flex-wrap: wrap;
	}

	.thumb {
		width: 40px;
		height: 40px;
		border-radius: var(--radius-s);
		overflow: hidden;
		border: 1px solid var(--background-modifier-border);
		display: block;
		transition: transform 0.15s;
	}

	.thumb:hover {
		transform: scale(1.1);
		border-color: var(--text-accent);
	}

	.thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	/* Links */
	.links {
		display: flex;
		gap: var(--size-2-1);
		flex-wrap: wrap;
		align-items: center;
	}

	/* Tags */
	.tags {
		display: flex;
		gap: var(--size-2-1);
		flex-wrap: wrap;
		align-items: center;
	}

	/* Count badges */
	.count {
		font-size: var(--font-ui-smaller);
		color: var(--text-faint);
		padding: 1px 4px;
		background: var(--background-modifier-border);
		border-radius: var(--radius-s);
	}

	/* Checkbox */
	.check {
		font-size: var(--font-ui-medium);
		color: var(--text-accent);
	}

	/* Link */
	.link {
		color: var(--text-accent);
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		gap: var(--size-2-1);
	}

	.link:hover {
		text-decoration: underline;
	}
</style>
