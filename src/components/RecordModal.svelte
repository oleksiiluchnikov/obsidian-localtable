<script lang="ts">
	import RecordView from "./RecordView.svelte";
	import Icon from "../ui/Icon.svelte";
	import { FieldResolver, type TableData } from "../features/airtable";

	let {
		record,
		tableData,
		onClose,
	}: {
		record: { id: string; fields: Record<string, any>; createdTime?: string };
		tableData: TableData;
		onClose: () => void;
	} = $props();

	let resolver = $derived(new FieldResolver(tableData));

	function handleClose() {
		onClose();
	}

	function handleBackdropClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			handleClose();
		}
	}

	function handleEscape(event: KeyboardEvent) {
		if (event.key === "Escape") {
			handleClose();
		}
	}
</script>

<svelte:window onkeydown={handleEscape} />

<div class="modal-backdrop" onclick={handleBackdropClick}>
	<div class="modal-container">
		<div class="modal-header">
			<h3 class="modal-title">Record Details</h3>
			<button class="modal-close" onclick={handleClose} title="Close (Esc)">
				<Icon icon="x" className="close-icon" />
			</button>
		</div>

		<div class="modal-content">
			<RecordView {record} {resolver} showMetadata={true} groupByType={false} />
		</div>

	</div>
</div>

<style>
	/* .modal-backdrop { */
	/* 	position: fixed; */
	/* 	top: 0; */
	/* 	left: 0; */
	/* 	right: 0; */
	/* 	bottom: 0; */
	/* 	background-color: rgba(0, 0, 0, 0.5); */
	/* 	display: flex; */
	/* 	align-items: center; */
	/* 	justify-content: center; */
	/* 	z-index: 1000; */
	/* 	padding: var(--size-4-4); */
	/* } */

	.modal-container {
		background-color: var(--background-primary);
		border-radius: var(--radius-l);
		box-shadow: var(--shadow-l);
		width: 100%;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.modal-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--size-4-4);
		border-bottom: 1px solid var(--background-modifier-border);
		background-color: var(--background-secondary);
	}

	.modal-title {
		margin: 0;
		font-size: var(--font-ui-large);
		font-weight: var(--font-semibold);
		color: var(--text-normal);
	}

	.modal-close {
		padding: var(--size-2-2);
		background: transparent;
		border: none;
		cursor: pointer;
		border-radius: var(--radius-s);
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background-color 0.15s;
	}

	.modal-close:hover {
		background-color: var(--background-modifier-hover);
	}

	:global(.close-icon) {
		width: 20px;
		height: 20px;
		color: var(--text-muted);
	}

	.modal-content {
		flex: 1;
		overflow-y: auto;
		padding: 0;
	}

	/* Scrollbar styling */
	.modal-content::-webkit-scrollbar {
		width: 10px;
	}

	.modal-content::-webkit-scrollbar-track {
		background: var(--background-secondary);
	}

	.modal-content::-webkit-scrollbar-thumb {
		background: var(--background-modifier-border);
		border-radius: var(--radius-s);
	}

	.modal-content::-webkit-scrollbar-thumb:hover {
		background: var(--text-muted);
	}
</style>
