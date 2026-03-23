/** Shared Airtable contracts aligned with the Airtable integration layer. */

export interface SortSpec {
	field: string;
	direction: "asc" | "desc" | string;
}

export interface FetchOptions {
	view?: string;
	filter?: string;
	fields?: string[];
	maxRecords?: number;
	forceRefresh?: boolean;
	skipDaemon?: boolean;
	resolveLinks?: boolean;
	returnFieldsByFieldId?: boolean;
	sort?: SortSpec[];
}

export interface SearchOptions {
	fields?: string[];
}

export interface MutationOptions {
	typecast?: boolean;
	returnFieldsByFieldId?: boolean;
}

export interface CreateFieldPayload {
	name: string;
	type: string;
	description?: string;
	options?: unknown;
}

export interface BatchUpdateItem {
	id: string;
	fields: Record<string, unknown>;
}

export interface AirtableRecord {
	id: string;
	fields: Record<string, unknown>;
	createdTime: string;
}

export interface GetRecordsResult {
	records: AirtableRecord[];
	offset?: string;
}

export interface SearchRecordsResult {
	records: AirtableRecord[];
	total: number;
	query: string;
}
