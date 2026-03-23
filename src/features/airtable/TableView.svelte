<script lang="ts">
import ViewHeader from "../../components/ViewHeader.svelte";
import LoadingSpinner from "../../ui/LoadingSpinner.svelte";
import TableHeader from "../../components/TableHeader.svelte";
import FieldsList from "../../components/FieldsList.svelte";
import ViewsList from "../../components/ViewsList.svelte";
import DetailsSection from "../../components/DetailsSection.svelte";
import RecordsList from "../../components/RecordsList.svelte";
import EmptyState from "../../ui/EmptyState.svelte";

import { airtableStore, type AirtableState } from ".";

// Props flow down from AirtableComponent which owns the single store subscription.
// No $derived($airtableStore.*) here — that pattern caused effect_update_depth_exceeded.
let { storeState }: { storeState: AirtableState | null } = $props();

let tableData       = $derived(storeState?.tableData      ?? null);
let loading         = $derived(storeState?.loading        ?? false);
let error           = $derived(storeState?.error          ?? "");
let expandedSections = $derived(storeState?.expandedSections ?? {
    fields: false, views: false, details: false, records: true
});
let lastRefresh     = $derived(storeState?.lastRefresh    ?? null);
let isCached        = $derived(storeState?.isCached       ?? false);

function toggleSection(section: "fields" | "views" | "details" | "records") {
    airtableStore.toggleSection(section);
}

function handleRecordClick(record: any) {
    airtableStore.selectRecord(record);
}
</script>

<div class="airtable-table">
    <ViewHeader
        title="Airtable Table"
        icon="database"
        {lastRefresh}
        {isCached}
    />

    <div class="view-content">
        {#if loading}
            <LoadingSpinner message="Loading table information..." />
        {:else if error}
            <EmptyState
                icon="alert-circle"
                title="Unable to load table"
                description={error}
                actionLabel="Try Again"
                onAction={() => airtableStore.loadTableInfo()}
            />
        {:else if tableData}
            <TableHeader data={tableData} {loading} {isCached} />

            <FieldsList
                fields={tableData.fields}
                primaryFieldId={tableData.primaryFieldId}
                expanded={expandedSections.fields}
                onToggle={() => toggleSection("fields")}
            />

            <ViewsList
                views={tableData.views}
                expanded={expandedSections.views}
                onToggle={() => toggleSection("views")}
            />

            {#if tableData.records && tableData.records.length > 0}
                <RecordsList
                    records={tableData.records}
                    tableData={tableData}
                    expanded={expandedSections.records}
                    onToggle={() => toggleSection("records")}
                    onRecordClick={handleRecordClick}
                />
            {/if}

            <DetailsSection
                tableId={tableData.id}
                primaryFieldName={tableData.fields.find(f => f.id === tableData.primaryFieldId)?.name || "N/A"}
                expanded={expandedSections.details}
                onToggle={() => toggleSection("details")}
            />
        {:else}
            <EmptyState
                icon="file-question"
                title="No table selected"
                description="Add <code>airtable_table_id</code> to your note's frontmatter"
            />
        {/if}
    </div>
</div>

<style>
.view-content {
    flex: 1;
    overflow-y: auto;
    padding: var(--size-4-4);
}
</style>
