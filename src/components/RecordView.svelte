<script lang="ts">
	import Icon from "../ui/Icon.svelte";
	import Badge from "../ui/Badge.svelte";
	import AirtableLinkButton from "./AirtableLinkButton.svelte";
	import LinkedRecordBadge from "./LinkedRecordsBadge.svelte";
	import CollapsibleSection from "./CollapsibleSection.svelte";
	import { FieldResolver, type ResolvedValue, type Field } from "../features/airtable";
	import { getFieldTypeIcon } from "../utils/iconMapping";

	let { record, resolver, showMetadata = true, groupByType = false }: {
		record: { id: string; fields: Record<string, any>; createdTime?: string };
		resolver: FieldResolver;
		showMetadata?: boolean;
		groupByType?: boolean;
	} = $props();

	let sectionsExpanded = $state<Record<string, boolean>>({
		fields: true,
		metadata: false,
		attachments: true,
		links: true
	});

	let resolvedFields = $derived(Object.entries(record.fields).map(([fieldName, value]) => {
		const field = resolver.getFieldByName(fieldName);
		const fieldId = field?.id || fieldName;
		return {
			name: fieldName,
			resolved: field ? resolver.resolve(fieldId, value) : {
				type: "text",
				displayValue: String(value),
				rawValue: value
			},
			field,
			fieldId
		};
	}));

	let primaryField = $derived(resolvedFields[0]);

	let attachmentFields = $derived(resolvedFields.filter(f =>
		f.resolved.type === "attachment" && f.resolved.rawValue?.length > 0
	));

	let linkedRecordFields = $derived(resolvedFields.filter(f =>
		f.resolved.type === "linkedRecords" && (f.resolved.metadata?.linkedRecords?.length ?? 0) > 0
	));

	let regularFields = $derived(resolvedFields.filter(f =>
		f !== primaryField &&
		f.resolved.type !== "attachment" &&
		f.resolved.type !== "linkedRecords"
	));

	let groupedFields = $derived(groupByType ? groupFieldsByType(regularFields) : { "All Fields": regularFields });

	function groupFieldsByType(fields: typeof regularFields) {
		const groups: Record<string, typeof regularFields> = {};
		fields.forEach(field => {
			const type = field.field?.type || "other";
			if (!groups[type]) groups[type] = [];
			groups[type].push(field);
		});
		return groups;
	}

	function toggleSection(section: string) {
		sectionsExpanded[section] = !sectionsExpanded[section];
	}

	function formatDate(dateString: string | undefined): string {
		if (!dateString) return "—";
		try {
			return new Date(dateString).toLocaleString();
		} catch {
			return dateString;
		}
	}

	function copyToClipboard(text: string) {
		navigator.clipboard.writeText(text);
	}

	function renderFieldValue(resolved: ResolvedValue): string {
		return resolved.displayValue;
	}

</script>

<div class="record-view">
	<!-- Header with primary field and actions -->
	<div class="record-header">
		<div class="record-title-section">
			<h2 class="record-title">
				{primaryField?.resolved.displayValue || record.id}
			</h2>
			<div class="record-subtitle">
				<Icon icon="database" className="subtitle-icon" />
				{resolver.getTableName()}
			</div>
		</div>

		<div class="record-actions">
            <AirtableLinkButton size="medium" />
			<button
				class="action-button"
				onclick={() => copyToClipboard(record.id)}
				title="Copy Record ID"
			>
				<Icon icon="copy" className="action-icon" />
			</button>
		</div>
	</div>

	<!-- Attachments Section -->
	{#if attachmentFields.length > 0}
		<CollapsibleSection
			title="Attachments"
			count={attachmentFields.reduce((acc, f) => acc + (f.resolved.rawValue?.length || 0), 0)}
			expanded={sectionsExpanded.attachments}
			onToggle={() => toggleSection('attachments')}
		>
			<div class="attachments-section">
				{#each attachmentFields as { name, resolved, field }}
					<div class="attachment-group">
						<div class="field-label">
							<Icon icon={getFieldTypeIcon(field?.type || 'attachment')} className="label-icon" />
							{name}
						</div>
						<div class="attachment-grid">
							{#each (resolved.rawValue || []) as attachment}
								<div class="attachment-item">
									{#if attachment.thumbnails?.large}
									<a href={attachment.url} target="_blank" rel="noopener noreferrer" class="attachment-preview">
											<img src={attachment.thumbnails.large.url} alt={attachment.filename} />
											<div class="attachment-overlay">
												<Icon icon="maximize-2" className="overlay-icon" />
											</div>
										</a>
									{:else}
									<a href={attachment.url} target="_blank" rel="noopener noreferrer" class="attachment-file">
											<Icon icon="file" className="file-icon" />
										</a>
									{/if}
									<div class="attachment-meta">
										<div class="attachment-name" title={attachment.filename}>
											{attachment.filename}
										</div>
										{#if attachment.size}
											<div class="attachment-size">
												{(attachment.size / 1024).toFixed(1)} KB
											</div>
										{/if}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</CollapsibleSection>
	{/if}

	<!-- Linked Records Section -->
	{#if linkedRecordFields.length > 0}
		<CollapsibleSection
			title="Linked Records"
			count={linkedRecordFields.reduce((acc, f) => acc + (f.resolved.metadata?.linkedRecords?.length || 0), 0)}
			expanded={sectionsExpanded.links}
			onToggle={() => toggleSection('links')}
		>
			<div class="links-section">
				{#each linkedRecordFields as { name, resolved, field }}
					<div class="link-group">
						<div class="field-label">
							<Icon icon={getFieldTypeIcon(field?.type || 'multipleRecordLinks')} className="label-icon" />
							{name}
							<Badge variant="default" size="small">
								{resolved.metadata?.linkedRecords?.length || 0}
							</Badge>
						</div>
						<div class="link-list">
							{#each (resolved.metadata?.linkedRecords || []) as linkedRecord}
								<LinkedRecordBadge record={linkedRecord} size="medium" />
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</CollapsibleSection>
	{/if}

	<!-- Regular Fields Section -->
	<CollapsibleSection
		title="Fields"
		count={regularFields.length}
		expanded={sectionsExpanded.fields}
		onToggle={() => toggleSection('fields')}
	>
		<div class="fields-section">
			{#if groupByType}
				{#each Object.entries(groupedFields) as [typeName, fields]}
					{#if fields.length > 0}
						<div class="field-type-group">
							<div class="type-header">{typeName}</div>
							{#each fields as { name, resolved, field }}
								<div class="field-row">
									<div class="field-label-row">
										<Icon icon={getFieldTypeIcon(field?.type || 'text')} className="label-icon" />
										<span class="field-name">{name}</span>
										{#if field?.type}
											<Badge variant="default" size="small">{field.type}</Badge>
										{/if}
									</div>
									<div class="field-value-row">
										{@html renderFieldValue(resolved)}
									</div>
								</div>
							{/each}
						</div>
					{/if}
				{/each}
			{:else}
				{#each regularFields as { name, resolved, field }}
					<div class="field-row">
						<div class="field-label-row">
							<Icon icon={getFieldTypeIcon(field?.type || 'text')} className="label-icon" />
							<span class="field-name">{name}</span>
							{#if field?.type}
								<Badge variant="default" size="small">{field.type}</Badge>
							{/if}
							{#if resolved.metadata?.isComputed}
								<Badge variant="accent" size="small">Computed</Badge>
							{/if}
						</div>
						<div class="field-value-row">
							{#if resolved.type === "multipleSelects"}
								<div class="tags-list">
									{#each (resolved.rawValue || []) as tag}
										<Badge variant="accent" size="medium">{tag}</Badge>
									{/each}
								</div>
							{:else if resolved.type === "checkbox"}
								<div class="checkbox-value" class:checked={resolved.rawValue}>
									<Icon icon={resolved.rawValue ? "check-square" : "square"} className="checkbox-icon" />
									{resolved.rawValue ? "Checked" : "Unchecked"}
								</div>
							{:else if resolved.type === "url" && resolved.rawValue}
							<a href={resolved.rawValue} target="_blank" rel="noopener noreferrer" class="url-link">
									{resolved.displayValue}
									<Icon icon="external-link" className="link-icon-inline" />
								</a>
							{:else if resolved.type === "button" && resolved.rawValue?.url}
							<a href={resolved.rawValue.url} target="_blank" rel="noopener noreferrer" class="button-link">
									<Icon icon="square-mouse-pointer" className="button-icon" />
									{resolved.displayValue}
									<Icon icon="external-link" className="link-icon-inline" />
								</a>
							{:else}
								<div class="text-value">{resolved.displayValue}</div>
							{/if}
						</div>
					</div>
				{/each}
			{/if}
		</div>
	</CollapsibleSection>

	<!-- Metadata Section -->
	{#if showMetadata}
		<CollapsibleSection
			title="Metadata"
			expanded={sectionsExpanded.metadata}
			onToggle={() => toggleSection('metadata')}
		>
			<div class="metadata-section">
				<div class="metadata-row">
					<div class="metadata-label">
						<Icon icon="hash" className="label-icon" />
						Record ID
					</div>
					<div class="metadata-value mono">
						{record.id}
						<button
							class="copy-button"
							onclick={() => copyToClipboard(record.id)}
							title="Copy"
						>
							<Icon icon="copy" className="copy-icon" />
						</button>
					</div>
				</div>

				{#if record.createdTime}
					<div class="metadata-row">
						<div class="metadata-label">
							<Icon icon="calendar-plus" className="label-icon" />
							Created
						</div>
						<div class="metadata-value">
							{formatDate(record.createdTime)}
						</div>
					</div>
				{/if}

				<div class="metadata-row">
					<div class="metadata-label">
						<Icon icon="list" className="label-icon" />
						Field Count
					</div>
					<div class="metadata-value">
						{Object.keys(record.fields).length} fields
					</div>
				</div>
			</div>
		</CollapsibleSection>
	{/if}

        <div class="raw-data">
            <pre>{JSON.stringify(record, null, 2)}</pre>
        </div>
</div>

<style>
	.record-view {
		display: flex;
		flex-direction: column;
		gap: var(--size-4-3);
		padding: var(--size-4-4);
		max-width: 100%;
	}

	/* Header */
	.record-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--size-4-3);
		padding-bottom: var(--size-4-3);
		border-bottom: 2px solid var(--background-modifier-border);
	}

	.record-title-section {
		flex: 1;
		min-width: 0;
	}

	.record-title {
		font-size: var(--font-ui-large);
		font-weight: var(--font-semibold);
		color: var(--text-normal);
		margin: 0 0 var(--size-2-2) 0;
		word-break: break-word;
	}

	.record-subtitle {
		display: flex;
		align-items: center;
		gap: var(--size-2-2);
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}

	:global(.subtitle-icon) {
		width: 14px;
		height: 14px;
		opacity: 0.7;
	}

	.record-actions {
		display: flex;
		gap: var(--size-2-2);
	}

	.action-button {
		padding: var(--size-2-2);
		background: var(--interactive-normal);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		cursor: pointer;
		transition: all 0.15s;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.action-button:hover {
		background: var(--interactive-hover);
		border-color: var(--text-accent);
	}

	:global(.action-icon) {
		width: 16px;
		height: 16px;
		color: var(--text-muted);
	}

	/* Attachments Section */
	.attachments-section {
		padding: var(--size-4-3);
		display: flex;
		flex-direction: column;
		gap: var(--size-4-4);
	}

	.attachment-group {
		display: flex;
		flex-direction: column;
		gap: var(--size-2-3);
	}

	.attachment-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
		gap: var(--size-4-2);
	}

	.attachment-item {
		display: flex;
		flex-direction: column;
		gap: var(--size-2-2);
	}

	.attachment-preview {
		position: relative;
		width: 100%;
		aspect-ratio: 1;
		border-radius: var(--radius-m);
		overflow: hidden;
		border: 1px solid var(--background-modifier-border);
		display: block;
		transition: all 0.2s;
	}

	.attachment-preview:hover {
		border-color: var(--text-accent);
		transform: scale(1.02);
	}

	.attachment-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.attachment-overlay {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		opacity: 0;
		transition: opacity 0.2s;
	}

	.attachment-preview:hover .attachment-overlay {
		opacity: 1;
	}

	:global(.overlay-icon) {
		width: 24px;
		height: 24px;
		color: white;
	}

	.attachment-file {
		width: 100%;
		aspect-ratio: 1;
		border-radius: var(--radius-m);
		border: 1px solid var(--background-modifier-border);
		background: var(--background-secondary);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s;
	}

	.attachment-file:hover {
		border-color: var(--text-accent);
		background: var(--interactive-hover);
	}

	:global(.file-icon) {
		width: 32px;
		height: 32px;
		color: var(--text-muted);
	}

	.attachment-meta {
		display: flex;
		flex-direction: column;
		gap: var(--size-2-1);
	}

	.attachment-name {
		font-size: var(--font-ui-smaller);
		color: var(--text-normal);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-weight: var(--font-medium);
	}

	.attachment-size {
		font-size: var(--font-ui-smaller);
		color: var(--text-faint);
	}

	/* Linked Records Section */
	.links-section {
		padding: var(--size-4-3);
		display: flex;
		flex-direction: column;
		gap: var(--size-4-3);
	}

	.link-group {
		display: flex;
		flex-direction: column;
		gap: var(--size-2-3);
	}

	.link-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--size-2-2);
	}

	/* Fields Section */
	.fields-section {
		padding: var(--size-4-3);
		display: flex;
		flex-direction: column;
	}

	.field-type-group {
		margin-bottom: var(--size-4-3);
	}

	.type-header {
		font-size: var(--font-ui-small);
		font-weight: var(--font-semibold);
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: var(--size-2-3);
		padding-bottom: var(--size-2-2);
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.field-row {
		display: flex;
		flex-direction: column;
		gap: var(--size-2-2);
		padding: var(--size-4-2);
		border-bottom: 1px solid var(--background-modifier-border-hover);
		transition: background-color 0.1s;
	}

	.field-row:hover {
		background-color: var(--background-secondary);
	}

	.field-row:last-child {
		border-bottom: none;
	}

	.field-label-row {
		display: flex;
		align-items: center;
		gap: var(--size-2-2);
	}

	.field-label {
		display: flex;
		align-items: center;
		gap: var(--size-2-2);
		font-size: var(--font-ui-small);
		font-weight: var(--font-medium);
		color: var(--text-muted);
		margin-bottom: var(--size-2-2);
	}

	:global(.label-icon) {
		width: 14px;
		height: 14px;
		opacity: 0.7;
		flex-shrink: 0;
	}

	.field-name {
		font-weight: var(--font-medium);
		color: var(--text-muted);
		font-size: var(--font-ui-small);
	}

	.field-value-row {
		color: var(--text-normal);
		font-size: var(--font-ui-medium);
		word-break: break-word;
	}

	/* Field Value Types */
	.tags-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--size-2-2);
	}

	.checkbox-value {
		display: flex;
		align-items: center;
		gap: var(--size-2-2);
	}

	.checkbox-value.checked {
		color: var(--text-accent);
	}

	:global(.checkbox-icon) {
		width: 18px;
		height: 18px;
	}

	.url-link,
	.button-link {
		color: var(--text-accent);
		text-decoration: none;
		display: inline-flex;
		align-items: center;
		gap: var(--size-2-2);
		transition: opacity 0.15s;
	}

	.url-link:hover,
	.button-link:hover {
		text-decoration: underline;
		opacity: 0.8;
	}

	.button-link {
		padding: var(--size-2-2) var(--size-4-2);
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border-radius: var(--radius-s);
		font-weight: var(--font-medium);
	}

	.button-link:hover {
		background: var(--interactive-accent-hover);
		text-decoration: none;
	}

	:global(.button-icon) {
		width: 14px;
		height: 14px;
	}

	:global(.link-icon-inline) {
		width: 14px;
		height: 14px;
		opacity: 0.7;
	}

	.text-value {
		white-space: pre-wrap;
	}

	/* Metadata Section */
	.metadata-section {
		padding: var(--size-4-3);
		display: flex;
		flex-direction: column;
		gap: var(--size-4-2);
	}

	.metadata-row {
		display: flex;
		flex-direction: column;
		gap: var(--size-2-2);
	}

	.metadata-label {
		display: flex;
		align-items: center;
		gap: var(--size-2-2);
		font-size: var(--font-ui-smaller);
		font-weight: var(--font-semibold);
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.metadata-value {
		font-size: var(--font-ui-small);
		color: var(--text-normal);
		display: flex;
		align-items: center;
		gap: var(--size-2-2);
	}

	.metadata-value.mono {
		font-family: var(--font-monospace);
		background: var(--background-primary-alt);
		padding: var(--size-2-2) var(--size-2-3);
		border-radius: var(--radius-s);
		word-break: break-all;
	}

	.copy-button {
		padding: var(--size-2-1);
		background: transparent;
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		cursor: pointer;
		transition: all 0.15s;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.copy-button:hover {
		background: var(--interactive-hover);
		border-color: var(--text-accent);
	}

	:global(.copy-icon) {
		width: 12px;
		height: 12px;
		color: var(--text-muted);
	}
</style>
