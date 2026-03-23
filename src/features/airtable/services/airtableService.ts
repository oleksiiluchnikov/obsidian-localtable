import type { App } from "obsidian";
import type { FetchOptions } from "../../../airtable";
import type { AirtableRecord } from "../../../airtable";
import { CacheService, CacheKeys } from "../../../services/cacheService";
import { LinkedRecordCache, type LinkedRecordInfo } from "./linkedRecordCache";
import { cacheClient } from "../../../services/cacheClient";

export interface SchemaFieldOptions {
	linkedTableId?: string;
	recordLinkFieldId?: string;
	fieldIdInLinkedTable?: string;
	[key: string]: unknown;
}

export interface Field {
	id: string;
	name: string;
	type: string;
	options?: SchemaFieldOptions;
}

export interface SchemaView {
	id: string;
	name: string;
	type: string;
}

export interface SchemaTable {
	id: string;
	name: string;
	fields: Field[];
	primaryFieldId: string;
	views: SchemaView[];
}

export interface TableData extends SchemaTable {
	records?: AirtableRecord[];
	baseSchema?: SchemaTable[];
	resolvedLinkedRecords?: Map<string, Map<string, LinkedRecordInfo>>;
}

export interface AirtableSettings {
	apiKey: string;
	baseId: string;
	cacheTableInfoMinutes: number;
	cacheRecordsMinutes: number;
	enableCachePersistence?: boolean;
}

export class AirtableService {
	private cache: CacheService;
	private linkedCache: LinkedRecordCache;
	private baseSchemaCache: SchemaTable[] | null = null;

	constructor(
		private app: App,
		private settings: AirtableSettings,
		enableCachePersistence: boolean = true
	) {
		this.cache = new CacheService(app, enableCachePersistence);
		this.linkedCache = new LinkedRecordCache(app, enableCachePersistence);
	}

	/** H3: Cancel pending save timers to prevent write-after-free on teardown */
	dispose(): void {
		this.cache.dispose();
	}

	async loadTableInfo(forceRefresh: boolean = false, specificTableId?: string): Promise<TableData> {
		let airtableTableId = specificTableId;

		// If no specific table requested, try to get from active file
		if (!airtableTableId) {
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile) throw new Error("No active file open");

			const frontmatter = this.app.metadataCache.getFileCache(activeFile)?.frontmatter;
			airtableTableId = frontmatter?.airtable_table_id;
		}

		if (!airtableTableId) throw new Error("Add 'airtable_table_id' to frontmatter");
		const { apiKey, baseId } = this.settings;

		// 1. Fetch ALL tables (Base Schema) - needed for Lookup resolution
		if (!this.baseSchemaCache || forceRefresh) {
			const data = await cacheClient.getSchema(baseId, apiKey);
			this.baseSchemaCache = getSchemaTables(data);
		}

		// 2. Find the requested table
		const table = this.baseSchemaCache?.find((schemaTable) => schemaTable.id === airtableTableId);
		if (!table) throw new Error(`Table ${airtableTableId} not found`);

		// Return table data attached with full schema for the resolver
		return {
			...table,
			baseSchema: this.baseSchemaCache
		};
	}

	/**
	 * Try to find which table a record belongs to using the cache
	 */
	findRecordTableId(recordId: string): string | null {
		const info = this.linkedCache.get(recordId);
		return info ? info.tableId : null;
	}

	/**
	 * Invalidate cache entries for a specific table.
	 * Clears schema/UI entries from CacheService and delegates record cache
	 * invalidation to the daemon (write-through proxy handles this automatically).
	 */
	invalidateTableCache(tableId: string): void {
		// Only invalidate schema/UI-state keys — record caching is owned by the daemon.
		this.cache.invalidatePattern(CacheKeys.tablePattern(this.settings.baseId, tableId));
		// Also invalidate the daemon cache so stale data isn't served after mutations.
		cacheClient.invalidate(this.settings.baseId, tableId).catch(() => {
			// Best-effort — daemon may be down
		});
	}

	async fetchRecords(tableIdOrName: string, options: FetchOptions = {}): Promise<AirtableRecord[]> {
		const { apiKey, baseId } = this.settings;
		// Record caching is now entirely owned by the daemon (L1/L2 cache with
		// stale-while-revalidate). No local CacheService layer for records.
		const result = await cacheClient.getRecords(baseId, tableIdOrName, apiKey, options);
		return result.records;
	}

	async fetchRecord(tableId: string, recordId: string): Promise<AirtableRecord> {
		const { apiKey, baseId } = this.settings;
		return cacheClient.getRecord(baseId, tableId, recordId, apiKey);
	}

	async batchResolveLinkedRecords(records: AirtableRecord[], tableData: TableData): Promise<Map<string, Map<string, LinkedRecordInfo>>> {
		const recordsByTable = new Map<string, Set<string>>();

		const addIds = (tblId: string, ids: unknown) => {
			if (!tblId) return;
			if (!recordsByTable.has(tblId)) recordsByTable.set(tblId, new Set());
			(Array.isArray(ids) ? ids : [ids]).forEach((id) => {
				if (typeof id === "string" && id.startsWith("rec")) {
					recordsByTable.get(tblId)?.add(id);
				}
			});
		};

		const fields = tableData.fields || [];

		for (const field of fields) {
			let targetTableId: string | undefined;

			if (field.type === 'multipleRecordLinks') {
				targetTableId = field.options?.linkedTableId;
			}
			else if (field.type === 'multipleLookupValues' || field.type === 'lookup' || field.type === 'rollup') {
				if (tableData.baseSchema) {
                    // Use recursive finder to handle Lookup -> Lookup -> Link chains
					targetTableId = this.findLookupTargetTable(field, tableData.baseSchema, new Set([field.id]));
				}
			}

			if (targetTableId) {
				for (const record of records) {
					const val = record.fields[field.name];
					if (val) {
						addIds(targetTableId!, val);
					}
				}
			}
		}

		const resolutionEntries = await Promise.all(
			Array.from(recordsByTable.entries())
				.filter(([, ids]) => ids.size > 0)
				.map(async ([tblId, ids]) => {
					const resolved = await this.resolveLinkedRecords(Array.from(ids), tblId, tableData.baseSchema);
					return [tblId, resolved] as const;
				}),
		);

		const allResolved = new Map<string, Map<string, LinkedRecordInfo>>(resolutionEntries);

		return allResolved;
	}

	/**
	 * Recursively find which table a Lookup/Rollup field points to
     * Handles chains like: Lookup -> Lookup -> Link
	 */
	private findLookupTargetTable(field: Field, baseSchema: SchemaTable[], visited: Set<string>): string | undefined {
        // Prevent infinite recursion in circular lookups
        if (!baseSchema) return undefined;

        const linkFieldId = field.options?.recordLinkFieldId;
        const remoteFieldId = field.options?.fieldIdInLinkedTable;

        if (!linkFieldId || !remoteFieldId) return undefined;

        // 1. Find the table that contains THIS field
		const currentTable = baseSchema.find((schemaTable) =>
			schemaTable.fields.some((schemaField) => schemaField.id === field.id),
		);
		if (!currentTable) return undefined;

		// 2. Find the link field used by the lookup
		const linkField = currentTable.fields.find((schemaField) => schemaField.id === linkFieldId);
		if (!linkField?.options?.linkedTableId) return undefined;

        const remoteTableId = linkField.options.linkedTableId;

        // 3. Find the remote table
		const remoteTable = baseSchema.find((schemaTable) => schemaTable.id === remoteTableId);
		if (!remoteTable) return undefined;

		// 4. Find the target field in the remote table
		const remoteField = remoteTable.fields.find((schemaField) => schemaField.id === remoteFieldId);
		if (!remoteField) return undefined;

        // 5. Check if we found the source, or need to dig deeper
        if (remoteField.type === 'multipleRecordLinks') {
            // Found it! This lookup eventually points to a Link
            return remoteField.options?.linkedTableId;
        }
		else if (['lookup', 'multipleLookupValues', 'rollup'].includes(remoteField.type)) {
			// It's another lookup, recurse!
			if (visited.has(remoteField.id)) {
				return undefined;
			}
            visited.add(remoteField.id);
            return this.findLookupTargetTable(remoteField, baseSchema, visited);
        }

        // It's just a text/number lookup, no table ID to resolve
        return undefined;
	}

	private async resolveLinkedRecords(ids: string[], tableId: string, baseSchema?: SchemaTable[]) {
		const cached = this.linkedCache.getMany(ids);
		const missing = this.linkedCache.findMissing(ids);

		if (missing.length === 0) return cached;

		const table = baseSchema?.find((schemaTable) => schemaTable.id === tableId);
		if (!table) return cached;

		const primaryField = table.fields.find((field) => field.id === table.primaryFieldId);
		if (!primaryField) return cached;

		try {
			const chunks = [];
			for (let i = 0; i < missing.length; i += 50) chunks.push(missing.slice(i, i + 50));

			const fetchedChunks = await Promise.all(
				chunks.map(async (chunk) => {
					const formula = `OR(${chunk.map(id => `RECORD_ID()='${id}'`).join(',')})`;
					const result = await cacheClient.getRecords(
						this.settings.baseId,
						tableId,
						this.settings.apiKey,
						{
							filter: formula,
							fields: [primaryField.name],
							maxRecords: chunk.length,
						},
					);
					return result.records.map((record) => {
						const fieldValue = record.fields[primaryField.name];
						return {
							id: record.id,
							name: typeof fieldValue === "string" && fieldValue.length > 0 ? fieldValue : "Untitled",
							tableId,
							tableName: typeof table.name === "string" ? table.name : tableId,
						};
					});
				}),
			);

			const fetched = fetchedChunks.flat();

			this.linkedCache.setMany(fetched);
			return this.linkedCache.getMany(ids);
		} catch {
			return cached;
		}
	}

}

function getSchemaTables(value: Record<string, unknown>): SchemaTable[] {
	const tables = value.tables;
	if (!Array.isArray(tables)) {
		return [];
	}
	return tables.filter(isSchemaTable);
}

function isSchemaTable(value: unknown): value is SchemaTable {
	if (!isObject(value)) {
		return false;
	}
	return (
		typeof value.id === "string" &&
		typeof value.name === "string" &&
		typeof value.primaryFieldId === "string" &&
		Array.isArray(value.fields) &&
		value.fields.every(isField) &&
		Array.isArray(value.views) &&
		value.views.every(isSchemaView)
	);
}

function isField(value: unknown): value is Field {
	return isObject(value) && typeof value.id === "string" && typeof value.name === "string" && typeof value.type === "string";
}

function isSchemaView(value: unknown): value is SchemaView {
	return isObject(value) && typeof value.id === "string" && typeof value.name === "string" && typeof value.type === "string";
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
