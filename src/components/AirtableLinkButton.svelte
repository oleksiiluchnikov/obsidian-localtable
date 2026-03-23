<script lang="ts">
import { onMount } from "svelte";
import Icon from "../ui/Icon.svelte";
import { airtableStore } from "../features/airtable";

let {
    size = "medium",
}: {
    size?: "small" | "medium" | "large";
} = $props();

let metadata: any = $state(null);
let isLinked = $state(false);
let isSynced = $state(false);
let checking = $state(true);
let checkInFlight = false;

async function checkStatus() {
    // Guard against re-entrant calls (e.g. triggered by store updates that
    // originate from hasAirtableLinkSynced → fetchRecords → store.update).
    if (checkInFlight) return;
    checkInFlight = true;
    try {
        checking = true;
        metadata = airtableStore.getCurrentAirtableMetadata();
        isLinked = !!metadata;
        if (isLinked) {
            isSynced = await airtableStore.hasAirtableLinkSynced();
        }
    } finally {
        checking = false;
        checkInFlight = false;
    }
}

async function handleAction() {
    if (!isLinked) return;
    if (isSynced) {
        await airtableStore.openRecordInBrowser();
    } else {
        await airtableStore.syncLinkToAirtable();
        await checkStatus();
    }
}

onMount(() => {
    // Check once on mount. handleAction re-checks after user-triggered syncs.
    // No store subscription here — subscribing and calling checkStatus() on
    // every store.update() causes an infinite loop because hasAirtableLinkSynced
    // internally calls fetchRecords() which calls store.update() again.
    checkStatus();
});
</script>

<div class="airtable-link-btn-container" class:size-small={size === "small"} class:size-medium={size === "medium"} class:size-large={size === "large"}>
    {#if checking}
        <button class="airtable-link-btn checking" disabled>
            <div class="spinner"></div>
            <span class="btn-text">Checking...</span>
        </button>
    {:else if !isLinked}
        <button class="airtable-link-btn not-linked" disabled title="Note not linked to Airtable">
            <Icon icon="link-2-off" className="btn-icon" />
            <span class="btn-text">Not linked</span>
        </button>
    {:else if isSynced}
        <button
            class="airtable-link-btn synced"
            onclick={handleAction}
            title="Open in Airtable"
        >
            <Icon icon="external-link" className="btn-icon" />
            <span class="btn-text">Open in Airtable</span>
        </button>
    {:else}
        <button
            class="airtable-link-btn not-synced"
            onclick={handleAction}
            title="Sync link to Airtable"
        >
            <Icon icon="link" className="btn-icon" />
            <span class="btn-text">Sync to Airtable</span>
        </button>
    {/if}
</div>

<style>
.airtable-link-btn-container {
    display: inline-flex;
}

.airtable-link-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border-radius: var(--radius-s);
    border: 1px solid var(--background-modifier-border);
    background: var(--interactive-normal);
    color: var(--text-normal);
    cursor: pointer;
    font-size: var(--font-ui-small);
    font-weight: var(--font-medium);
    transition: all 0.2s;
    white-space: nowrap;
}

.airtable-link-btn:not(:disabled):hover {
    background: var(--interactive-hover);
    border-color: var(--text-accent);
}

.airtable-link-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
}

/* State-specific styling */
.airtable-link-btn.synced {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
}

.airtable-link-btn.synced:hover {
    background: var(--interactive-accent-hover);
}

.airtable-link-btn.not-synced {
    background: var(--background-secondary);
    border-color: var(--text-accent);
    color: var(--text-accent);
}

.airtable-link-btn.not-synced:hover {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
}

.airtable-link-btn.not-linked {
    background: var(--background-secondary);
    color: var(--text-faint);
}

.airtable-link-btn.checking {
    cursor: wait;
}

/* Size variants */
.size-small .airtable-link-btn {
    padding: 4px 8px;
    font-size: var(--font-ui-smaller);
}

.size-small :global(.btn-icon) {
    width: 12px;
    height: 12px;
}

.size-medium .airtable-link-btn {
    padding: 6px 12px;
    font-size: var(--font-ui-small);
}

.size-medium :global(.btn-icon) {
    width: 14px;
    height: 14px;
}

.size-large .airtable-link-btn {
    padding: 8px 16px;
    font-size: var(--font-ui-medium);
}

.size-large :global(.btn-icon) {
    width: 16px;
    height: 16px;
}

:global(.btn-icon) {
    flex-shrink: 0;
}

.btn-text {
    line-height: 1;
}

.spinner {
    width: 12px;
    height: 12px;
    border: 2px solid var(--text-muted);
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}
</style>
