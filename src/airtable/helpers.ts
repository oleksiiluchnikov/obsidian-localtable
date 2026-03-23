import type {
	AirtableRecord,
	BatchUpdateItem,
	CreateFieldPayload,
	FetchOptions,
	MutationOptions,
	SearchOptions,
	SearchRecordsResult,
	SortSpec,
} from "./types";

export const AIRTABLE_API_BASE_URL = "https://api.airtable.com/v0";
export const AIRTABLE_META_BASE_URL = `${AIRTABLE_API_BASE_URL}/meta/bases`;
export const LOCALTABLE_HTTP_URL = "http://127.0.0.1:8899";
export const BATCH_MUTATION_LIMIT = 10;

export interface CachedJsonValue {
	value: Record<string, unknown>;
	fetchedAt: number;
}

export interface AirtablePageResponse {
	records: AirtableRecord[];
	offset?: string;
}

export function buildDirectRecordsUrl(
	baseId: string,
	tableId: string,
	options: FetchOptions = {},
	offset?: string,
): string {
	const query = new URLSearchParams();
	if (options.view) query.set("view", options.view);
	if (options.filter) query.set("filterByFormula", options.filter);
	if (options.maxRecords) query.set("maxRecords", String(options.maxRecords));
	appendSortQuery(query, options.sort);
	appendFieldsQuery(query, options.fields);
	if (options.returnFieldsByFieldId) {
		query.set("returnFieldsByFieldId", "1");
	}
	if (offset) query.set("offset", offset);

	const qs = query.toString();
	const path = `${AIRTABLE_API_BASE_URL}/${baseId}/${tableId}`;
	return qs ? `${path}?${qs}` : path;
}

export function buildDaemonRecordsPath(
	baseId: string,
	tableId: string,
	options: FetchOptions = {},
): string {
	const query = new URLSearchParams();
	if (options.view) query.set("view", options.view);
	if (options.filter) query.set("filterByFormula", options.filter);
	if (options.maxRecords) query.set("maxRecords", String(options.maxRecords));
	appendFieldsQuery(query, options.fields);
	appendSortQuery(query, options.sort);
	if (options.returnFieldsByFieldId) {
		query.set("returnFieldsByFieldId", "1");
	}

	const path = `/v0/${baseId}/${tableId}`;
	const qs = query.toString();
	return qs ? `${path}?${qs}` : path;
}

export function buildDaemonSearchPath(
	baseId: string,
	tableId: string,
	queryText: string,
	options: SearchOptions = {},
): string {
	const query = new URLSearchParams({ q: queryText });
	appendFieldsQuery(query, options.fields);
	return `/_local/search/bases/${baseId}/tables/${tableId}?${query.toString()}`;
}

export function buildSchemaUrl(baseId: string): string {
	return `${AIRTABLE_META_BASE_URL}/${baseId}/tables`;
}

export function buildBaseMetadataUrl(baseId: string): string {
	return `${AIRTABLE_META_BASE_URL}/${baseId}`;
}

export function buildRecordUrl(baseId: string, tableId: string, recordId: string): string {
	return `${AIRTABLE_API_BASE_URL}/${baseId}/${tableId}/${recordId}`;
}

export function buildCreateFieldUrl(baseId: string, tableId: string): string {
	return `${AIRTABLE_META_BASE_URL}/${baseId}/tables/${tableId}/fields`;
}

export function buildMutationQuery(options: MutationOptions = {}): string {
	const query = new URLSearchParams();
	if (options.typecast) query.set("typecast", "true");
	if (options.returnFieldsByFieldId) {
		query.set("returnFieldsByFieldId", "true");
	}
	const qs = query.toString();
	return qs ? `?${qs}` : "";
}

export function normalizeRecord(value: unknown): AirtableRecord {
	if (Array.isArray(value)) {
		return {
			id: String(value[0] ?? ""),
			fields: toRecordFields(value[1]),
			createdTime: String(value[2] ?? ""),
		};
	}
	if (isAirtableRecord(value)) {
		return value;
	}
	return { id: "", fields: {}, createdTime: "" };
}

export function parseAirtablePageResponse(value: unknown): AirtablePageResponse {
	if (!isObject(value)) {
		return { records: [] };
	}
	return {
		records: Array.isArray(value.records) ? value.records.map(normalizeRecord) : [],
		offset: typeof value.offset === "string" ? value.offset : undefined,
	};
}


export function parseDaemonRecordsResponse(value: unknown): { records: AirtableRecord[]; offset?: string } {
	if (!isObject(value)) {
		return { records: [] };
	}
	return {
		records: Array.isArray(value.records) ? value.records.map(normalizeRecord) : [],
		offset: typeof value.offset === "string" ? value.offset : undefined,
	};
}

export function parseSearchRecordsResponse(value: unknown, queryText: string): SearchRecordsResult {
	if (!isObject(value)) {
		return { records: [], total: 0, query: queryText };
	}
	return {
		records: Array.isArray(value.records) ? value.records.map(normalizeRecord) : [],
		total: typeof value.total === "number" ? value.total : 0,
		query: typeof value.query === "string" ? value.query : queryText,
	};
}

export function parseObjectResponse(value: unknown, errorMessage: string): Record<string, unknown> {
	if (isObject(value)) {
		return value;
	}
	throw new Error(errorMessage);
}

export function parseBatchRecordsResponse(value: unknown): AirtableRecord[] {
	if (!isObject(value) || !Array.isArray(value.records)) {
		return [];
	}
	return value.records.map(normalizeRecord);
}

export function chunkArray<T>(items: T[], chunkSize: number): T[][] {
	const chunks: T[][] = [];
	for (let index = 0; index < items.length; index += chunkSize) {
		chunks.push(items.slice(index, index + chunkSize));
	}
	return chunks;
}

export function buildBatchCreateBody(fieldsList: Record<string, unknown>[]): { records: Array<{ fields: Record<string, unknown> }> } {
	return { records: fieldsList.map((fields) => ({ fields })) };
}

export function buildBatchUpdateBody(updates: BatchUpdateItem[]): { records: BatchUpdateItem[] } {
	return { records: updates };
}

export function buildCreateBody(fields: Record<string, unknown>): { fields: Record<string, unknown> } {
	return { fields };
}

export function buildCreateFieldBody(payload: CreateFieldPayload): CreateFieldPayload {
	return payload;
}

function appendFieldsQuery(query: URLSearchParams, fields?: string[]): void {
	if (!fields) return;
	for (const field of fields) {
		query.append("fields[]", field);
	}
}

function appendSortQuery(query: URLSearchParams, sort?: SortSpec[]): void {
	if (!sort) return;
	for (const [index, spec] of sort.entries()) {
		query.append(`sort[${index}][field]`, spec.field);
		query.append(`sort[${index}][direction]`, spec.direction);
	}
}

function toRecordFields(value: unknown): Record<string, unknown> {
	return isObject(value) ? value : {};
}

function isAirtableRecord(value: unknown): value is AirtableRecord {
	return (
		isObject(value) &&
		typeof value.id === "string" &&
		isObject(value.fields) &&
		typeof value.createdTime === "string"
	);
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
