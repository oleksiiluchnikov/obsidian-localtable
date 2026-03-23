import { writable, get } from "svelte/store";
import type { App } from "obsidian";
import { Notice, TFile } from "obsidian";
import type { AirtableRecord } from "../../../airtable";
import { AirtableService, type TableData } from "../services/airtableService";
import type { LinkedRecordInfo } from "../services/linkedRecordCache";
import { NoteGenerator } from "../services/noteGenerator";
import { LinkSyncService } from "../services/linkSyncService";

interface PluginSettings {
	apiKey: string;
	baseId: string;
	cacheTableInfoMinutes: number;
	cacheRecordsMinutes: number;
	enableCachePersistence?: boolean;
	obsidianLinkFieldName: string;
	templatePath: string;
	newNoteLocation: string;
}

interface AirtableMetadata {
	recordId: string;
	tableId?: string;
	airtableUrl?: string;
	hasAirtableLink: true;
}

export interface AirtableState {
    tableData: TableData | null;
    loading: boolean;
    error: string;
    activeViewId: string | null;
    expandedSections: {
        fields: boolean;
        views: boolean;
        details: boolean;
        records: boolean;
	};
	lastRefresh: number | null;
	isCached: boolean;
	selectedRecord: AirtableRecord | null;
}

const initialState: AirtableState = {
    tableData: null,
    loading: false,
    error: "",
    activeViewId: null,
    expandedSections: {
        fields: false,
        views: false,
        details: false,
        records: true,
    },
    lastRefresh: null,
    isCached: false,
    selectedRecord: null,
};

const createAirtableStore = () => {
    const store = writable<AirtableState>(initialState);
    const { subscribe, set, update } = store;

	let _app: App | null = null;
	let service: AirtableService | null = null;
	let noteGenerator: NoteGenerator | null = null;
	let linkSyncService: LinkSyncService | null = null;
	let pluginSettings: PluginSettings | null = null;

    // H1: in-flight guards prevent concurrent races
    let selectInFlight = false;
    let fetchInFlight = false;

    return {
        subscribe,

		init: (app: App, settings: PluginSettings) => {
            _app = app;
            service = new AirtableService(app, settings, settings.enableCachePersistence);
            noteGenerator = new NoteGenerator(app);
            linkSyncService = new LinkSyncService(app);
		pluginSettings = settings;
		},

		loadRecord: async (recordId: string, tableId: string) => {
			if (!service) return;

			update((state) => ({
				...state,
				loading: true,
				error: "",
				selectedRecord: null,
			}));

			try {
				const record = await service.fetchRecord(tableId, recordId);
				update((state) => ({
					...state,
					selectedRecord: record,
					loading: false,
					error: "",
				}));
			} catch (error: unknown) {
				update((state) => ({
					...state,
					selectedRecord: null,
					loading: false,
					error: getErrorMessage(error),
				}));
			}
		},

        // 🟢 SMART LOAD: Only fetch if we are switching tables
		loadTableInfo: async (forceRefresh: boolean = false, specificTableId?: string) => {
            if (!service) return;
            const currentState = get(store);

            // Optimization: If we are already on this table, do nothing (unless forced)
            if (!forceRefresh && specificTableId && currentState.tableData?.id === specificTableId) {
                return;
            }

            update(state => ({ ...state, loading: true, error: "" }));

            try {
                const tableData = await service.loadTableInfo(forceRefresh, specificTableId);
                update(state => ({
                    ...state,
                    tableData,
                    loading: false,
                    lastRefresh: Date.now(),
                    // M5: only mark isCached if data was already loaded (not first cold fetch)
                    isCached: forceRefresh ? false : !!currentState.tableData,
                }));
			} catch (error: unknown) {
				update((state) => ({ ...state, error: getErrorMessage(error), loading: false }));
			}
        },

        findTableForRecord: (recordId: string): string | null => {
            return service ? service.findRecordTableId(recordId) : null;
        },

        // H1: mutex prevents concurrent fetchRecords calls during rapid navigation
		selectRecordById: async (recordId: string) => {
            if (selectInFlight) return;
            selectInFlight = true;
            try {
                const currentState = get(store);
                if (!currentState.tableData?.records) {
                    await airtableStore.fetchRecords(false);
                }

                const freshState = get(store);
                const records = freshState.tableData?.records || [];
                const record = records.find(r => r.id === recordId) || null;

				// M15: surface "not found" as an error instead of silent infinite loader
				if (!record) {
					update(state => ({
						...state,
                        selectedRecord: null,
                        error: `Record ${recordId} not found in table data.`,
                    }));
                    return;
                }

                update(state => ({ ...state, selectedRecord: record, error: "" }));
            } finally {
                selectInFlight = false;
            }
        },

        // Update the syncLinkToAirtable method
        syncLinkToAirtable: async () => {
            if (!linkSyncService || !pluginSettings || !_app) {
                new Notice("Link sync service is not initialized.");
                return;
            }

            const state = get(store);

            // Pass tableData to enable auto-creation
            await linkSyncService.syncCurrentNote(
                pluginSettings.apiKey,
                pluginSettings.baseId,
                pluginSettings.obsidianLinkFieldName,
                state.tableData || undefined // 🟢 Pass tableData for auto-create
            );

            // Refresh table schema and records to show new field
            await airtableStore.loadTableInfo(true); // Force refresh schema
            await airtableStore.fetchRecords(true);
        },

        // Update the batchSyncLinks method
        batchSyncLinks: async () => {
            if (!linkSyncService || !pluginSettings || !_app) return;

            const state = get(store);
            if (!state.tableData) {
                new Notice("No table data loaded.");
                return;
            }

            // Find all vault files with UUIDs
            const files = _app.vault.getMarkdownFiles();
            const recordMap = new Map<string, TFile>();

            for (const file of files) {
                const cache = _app.metadataCache.getFileCache(file);
                const uuid = cache?.frontmatter?.uuid;
                const tableId = cache?.frontmatter?.airtable_table_id;

                // Only include records from the current table
                if (uuid && uuid.startsWith('rec') && tableId === state.tableData.id) {
                    recordMap.set(uuid, file);
                }
            }

            if (recordMap.size === 0) {
                new Notice("No notes found for records in this table.");
                return;
            }

            new Notice(`Syncing ${recordMap.size} links...`);

			const { success, failed } = await linkSyncService.batchSyncLinks(
				recordMap,
				state.tableData,
				pluginSettings.obsidianLinkFieldName,
				pluginSettings.apiKey,
				pluginSettings.baseId,
				() => undefined
			);

            new Notice(
                `Synced ${success} links${failed > 0 ? `, ${failed} failed` : ''}.`,
                5000
            );

            // Refresh to show updated data
            await airtableStore.loadTableInfo(true);
            await airtableStore.fetchRecords(true);
        },


		fetchRecords: async (forceRefresh: boolean = false) => {
            if (!service) return;
            // H1: debounce concurrent calls (allow forceRefresh to proceed)
            if (fetchInFlight && !forceRefresh) return;
            fetchInFlight = true;

            const currentState = get(store);
            const tableData = currentState.tableData;

            if (!tableData) {
                update(state => ({ ...state, error: "Load table info first" }));
                fetchInFlight = false;
                return;
            }

            if (!currentState.tableData?.records) {
                update(state => ({ ...state, loading: true }));
            }

			try {
				const expectedTableId = tableData.id;
				const activeViewId = currentState.activeViewId;
				const tableIdentifier = tableData.id || tableData.name;
				const records = await service.fetchRecords(tableIdentifier, {
					forceRefresh,
					view: activeViewId ?? undefined,
				});

				update(state => {
					// M5: guard against tableData becoming null mid-flight
					if (!state.tableData || state.tableData.id !== expectedTableId) return state;
					return {
						...state,
						tableData: {
							...state.tableData,
							records,
						},
						loading: false,
						lastRefresh: Date.now(),
                        isCached: !forceRefresh,
                        expandedSections: { ...state.expandedSections, records: true }
					};
				});

				void resolveLinkedRecordsForCurrentTable(records, expectedTableId);
			} catch (error: unknown) {
				update((state) => ({ ...state, error: getErrorMessage(error), loading: false }));
			} finally {
				fetchInFlight = false;
			}
        },

		resolveSelectedRecordLinks: async () => {
			const state = get(store);
			if (!state.selectedRecord || !state.tableData) return;
			await resolveLinkedRecordsForCurrentTable([state.selectedRecord], state.tableData.id);
		},

		checkNoteStatus: async (recordId: string) => {
            if (!pluginSettings || !_app) return { exists: false, baseId: "" };
            const app = _app;
            const file = app.vault.getFiles().find(f => {
                const cache = app.metadataCache.getFileCache(f);
                return cache?.frontmatter?.uuid === recordId;
            });
            return { exists: !!file, baseId: pluginSettings.baseId };
        },

        openNote: async (recordId: string) => {
            if (!_app) return;
            const app = _app;
            const file = app.vault.getFiles().find(f => {
                const cache = app.metadataCache.getFileCache(f);
                return cache?.frontmatter?.uuid === recordId;
            });

            if (file) {
                await _app.workspace.getLeaf(false).openFile(file);
            }
        },

		createNote: async (record: AirtableRecord) => {
			const state = get(store);
			if (noteGenerator && state.tableData && pluginSettings) {
                await noteGenerator.createNote(
                    record,
                    state.tableData,
                    pluginSettings.baseId,
                    pluginSettings.templatePath,
                    pluginSettings.newNoteLocation
                );
            }
        },

        // H2: null ALL service references to prevent dangling async continuations
        reset: () => {
            set(initialState);
            service?.dispose(); // H3: cancel pending CacheService timers
            service = null;
            noteGenerator = null;
            linkSyncService = null;
            pluginSettings = null;
            _app = null;
            selectInFlight = false;
            fetchInFlight = false;
        },

        toggleSection: (section: keyof AirtableState["expandedSections"]) => {
            update(state => ({
                ...state,
                expandedSections: {
                    ...state.expandedSections,
                    [section]: !state.expandedSections[section],
                },
            }));
        },

		setActiveView: (viewId: string | null) => {
			update((state) => {
				if (state.activeViewId === viewId) {
					return state;
				}

				return {
					...state,
					activeViewId: viewId,
					selectedRecord: null,
					error: "",
					tableData: state.tableData
						? {
							...state.tableData,
							records: undefined,
						}
						: state.tableData,
				};
			});
		},

		selectRecord: (record: AirtableRecord) => update((state) => ({ ...state, selectedRecord: record })),

        closeRecordView: () => update(s => ({ ...s, selectedRecord: null })),

        clearCache: () => {
            if (service) {
                const s = get(store);
                if (s.tableData) service.invalidateTableCache(s.tableData.id);
            }
        },



        // L6: removed dead getResolvedFields placeholder

        getCurrentRecordId: (): string | null => {
            if (!_app) return null;

            const activeFile = _app.workspace.getActiveFile();
            if (!activeFile) return null;

            const cache = _app.metadataCache.getFileCache(activeFile);
            const uuid = cache?.frontmatter?.uuid;

            return (uuid && uuid.startsWith('rec')) ? uuid : null;
        },

        /**
         * Get current note's Airtable metadata
         */
		getCurrentAirtableMetadata: (): AirtableMetadata | null => {
            if (!_app) return null;

            const activeFile = _app.workspace.getActiveFile();
            if (!activeFile) return null;

            const cache = _app.metadataCache.getFileCache(activeFile);
            const frontmatter = cache?.frontmatter;

            if (!frontmatter?.uuid || !frontmatter.uuid.startsWith('rec')) {
                return null;
            }

            return {
                recordId: frontmatter.uuid,
                tableId: frontmatter.airtable_table_id,
                airtableUrl: frontmatter.airtable_url,
                hasAirtableLink: true
            };
        },

        /**
         * Open current record in Airtable (browser)
         */
        openRecordInBrowser: async () => {
            const metadata = airtableStore.getCurrentAirtableMetadata();

            if (!metadata) {
                new Notice("Current note is not linked to Airtable.");
                return;
            }

            // Try to use the stored URL first
            if (metadata.airtableUrl) {
                window.open(metadata.airtableUrl, '_blank');
                return;
            }

            // Fallback: construct URL from parts
            if (metadata.tableId && pluginSettings?.baseId) {
                const url = `https://airtable.com/${pluginSettings.baseId}/${metadata.tableId}/${metadata.recordId}`;
                window.open(url, '_blank');
                return;
            }

            new Notice("Unable to construct an Airtable URL.");
        },

        /**
         * Check if current note has Airtable link synced
         */
        hasAirtableLinkSynced: async (): Promise<boolean> => {
            if (!_app || !pluginSettings) return false;

            const metadata = airtableStore.getCurrentAirtableMetadata();
            if (!metadata) return false;

            const state = get(store);
            if (!state.tableData?.records) {
                // Need to fetch records first
                await airtableStore.fetchRecords(false);
            }

            const freshState = get(store);
            const record = freshState.tableData?.records?.find(
                r => r.id === metadata.recordId
            );

            if (!record) return false;

            // Check if the link field exists and has a value
            const linkFieldName = pluginSettings.obsidianLinkFieldName;
            const linkValue = record.fields[linkFieldName];

            return !!linkValue && typeof linkValue === 'string' && linkValue.length > 0;
        },

	};

	async function resolveLinkedRecordsForCurrentTable(
		records: AirtableRecord[],
		expectedTableId: string,
	): Promise<void> {
		if (!service || records.length === 0) return;

		const state = get(store);
		if (!state.tableData || state.tableData.id !== expectedTableId) return;

		try {
			const resolvedLinkedRecords = await service.batchResolveLinkedRecords(records, state.tableData);
			update((currentState) => {
				if (!currentState.tableData || currentState.tableData.id !== expectedTableId) {
					return currentState;
				}

				return {
					...currentState,
					tableData: {
						...currentState.tableData,
						resolvedLinkedRecords: mergeResolvedLinkedRecords(
							currentState.tableData.resolvedLinkedRecords,
							resolvedLinkedRecords,
						),
					},
				};
			});
		} catch {
			// Leave unresolved labels in place.
		}
	}
};

export const airtableStore = createAirtableStore();

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return "Unknown error";
}

function mergeResolvedLinkedRecords(
	existing: Map<string, Map<string, LinkedRecordInfo>> | undefined,
	incoming: Map<string, Map<string, LinkedRecordInfo>>,
): Map<string, Map<string, LinkedRecordInfo>> {
	const merged = new Map<string, Map<string, LinkedRecordInfo>>();

	for (const [tableId, entries] of existing ?? new Map()) {
		merged.set(tableId, new Map(entries));
	}

	for (const [tableId, entries] of incoming) {
		const current = merged.get(tableId) ?? new Map<string, LinkedRecordInfo>();
		for (const [recordId, info] of entries) {
			current.set(recordId, info);
		}
		merged.set(tableId, current);
	}

	return merged;
}
