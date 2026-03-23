import { requestUrl } from "obsidian";

import {
	AIRTABLE_API_BASE_URL,
	BATCH_MUTATION_LIMIT,
	CachedJsonValue,
	buildBaseMetadataUrl,
	buildBatchCreateBody,
	buildBatchUpdateBody,
	buildCreateBody,
	buildCreateFieldBody,
	buildCreateFieldUrl,
	buildDirectRecordsUrl,
	buildMutationQuery,
	buildRecordUrl,
	buildSchemaUrl,
	chunkArray,
	normalizeRecord,
	parseAirtablePageResponse,
	parseBatchRecordsResponse,
	parseObjectResponse,
} from "./helpers";
import type {
	AirtableRecord,
	BatchUpdateItem,
	CreateFieldPayload,
	FetchOptions,
	MutationOptions,
} from "./types";

const SCHEMA_TTL_MS = 300_000;
const METADATA_TTL_MS = 300_000;

/** Mobile-safe Airtable client built on Obsidian requestUrl. */
export class AirtableDirectClient {
	private readonly schemaCache = new Map<string, CachedJsonValue>();
	private readonly metadataCache = new Map<string, CachedJsonValue>();

	async getRecords(baseId: string, tableId: string, apiKey: string, options: FetchOptions = {}): Promise<AirtableRecord[]> {
		const records: AirtableRecord[] = [];
		let offset: string | undefined;

		do {
			const response = await this.requestJson(
				buildDirectRecordsUrl(baseId, tableId, options, offset),
				apiKey,
			);
			const page = parseAirtablePageResponse(response);
			records.push(...page.records);
			offset = page.offset;
			if (options.maxRecords && records.length >= options.maxRecords) {
				records.length = options.maxRecords;
				offset = undefined;
			}
		} while (offset);

		return records;
	}

	async getSchema(baseId: string, apiKey: string): Promise<Record<string, unknown>> {
		const cached = this.getCached(this.schemaCache, baseId, SCHEMA_TTL_MS);
		if (cached) return cached;

		const schema = parseObjectResponse(
			await this.requestJson(buildSchemaUrl(baseId), apiKey),
			"Invalid Airtable schema response",
		);
		this.schemaCache.set(baseId, { value: schema, fetchedAt: Date.now() });
		return schema;
	}

	async getBaseMetadata(baseId: string, apiKey: string): Promise<Record<string, unknown>> {
		const cached = this.getCached(this.metadataCache, baseId, METADATA_TTL_MS);
		if (cached) return cached;

		const metadata = parseObjectResponse(
			await this.requestJson(buildBaseMetadataUrl(baseId), apiKey),
			"Invalid Airtable base metadata response",
		);
		this.metadataCache.set(baseId, { value: metadata, fetchedAt: Date.now() });
		return metadata;
	}

	async getRecord(baseId: string, tableId: string, recordId: string, apiKey: string): Promise<AirtableRecord> {
		return normalizeRecord(await this.requestJson(buildRecordUrl(baseId, tableId, recordId), apiKey));
	}

	async createRecord(
		baseId: string,
		tableId: string,
		fields: Record<string, unknown>,
		apiKey: string,
		options: MutationOptions = {},
	): Promise<AirtableRecord> {
		const url = `${AIRTABLE_API_BASE_URL}/${baseId}/${tableId}${buildMutationQuery(options)}`;
		return normalizeRecord(await this.requestJson(url, apiKey, "POST", buildCreateBody(fields)));
	}

	async createRecords(
		baseId: string,
		tableId: string,
		fieldsList: Record<string, unknown>[],
		apiKey: string,
		options: MutationOptions = {},
	): Promise<AirtableRecord[]> {
		const url = `${AIRTABLE_API_BASE_URL}/${baseId}/${tableId}${buildMutationQuery(options)}`;
		const created: AirtableRecord[] = [];
		for (const chunk of chunkArray(fieldsList, BATCH_MUTATION_LIMIT)) {
			const response = await this.requestJson(url, apiKey, "POST", buildBatchCreateBody(chunk));
			created.push(...parseBatchRecordsResponse(response));
		}
		return created;
	}

	async updateRecord(
		baseId: string,
		tableId: string,
		recordId: string,
		fields: Record<string, unknown>,
		apiKey: string,
		options: MutationOptions = {},
	): Promise<AirtableRecord> {
		const url = `${buildRecordUrl(baseId, tableId, recordId)}${buildMutationQuery(options)}`;
		return normalizeRecord(await this.requestJson(url, apiKey, "PATCH", buildCreateBody(fields)));
	}

	async updateRecords(
		baseId: string,
		tableId: string,
		updates: BatchUpdateItem[],
		apiKey: string,
		options: MutationOptions = {},
	): Promise<AirtableRecord[]> {
		const url = `${AIRTABLE_API_BASE_URL}/${baseId}/${tableId}${buildMutationQuery(options)}`;
		const updated: AirtableRecord[] = [];
		for (const chunk of chunkArray(updates, BATCH_MUTATION_LIMIT)) {
			const response = await this.requestJson(url, apiKey, "PATCH", buildBatchUpdateBody(chunk));
			updated.push(...parseBatchRecordsResponse(response));
		}
		return updated;
	}

	async deleteRecord(baseId: string, tableId: string, recordId: string, apiKey: string): Promise<void> {
		await this.requestJson(buildRecordUrl(baseId, tableId, recordId), apiKey, "DELETE");
	}

	async createField(
		baseId: string,
		tableId: string,
		payload: CreateFieldPayload,
		apiKey: string,
	): Promise<Record<string, unknown>> {
		const response = await this.requestJson(
			buildCreateFieldUrl(baseId, tableId),
			apiKey,
			"POST",
			buildCreateFieldBody(payload),
		);
		this.invalidateSchemaCache(baseId);
		this.invalidateBaseMetadataCache(baseId);
		return parseObjectResponse(response, "Invalid Airtable field creation response");
	}

	invalidateSchemaCache(baseId: string): void {
		this.schemaCache.delete(baseId);
	}

	invalidateBaseMetadataCache(baseId: string): void {
		this.metadataCache.delete(baseId);
	}

	private getCached(
		cache: Map<string, CachedJsonValue>,
		cacheKey: string,
		ttlMs: number,
	): Record<string, unknown> | null {
		const entry = cache.get(cacheKey);
		if (!entry) return null;
		if (Date.now() - entry.fetchedAt >= ttlMs) {
			cache.delete(cacheKey);
			return null;
		}
		return entry.value;
	}

	private async requestJson(
		url: string,
		apiKey: string,
		method: string = "GET",
		body?: unknown,
	): Promise<unknown> {
		const response = await requestUrl({
			url,
			method,
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: body === undefined ? undefined : JSON.stringify(body),
			throw: false,
		});

		if (response.status >= 400) {
			throw new Error(this.buildErrorMessage(response.text, response.status));
		}

		return response.json;
	}

	private buildErrorMessage(responseText: string, status: number): string {
		if (!responseText) return `Airtable API error (${status})`;
		try {
			const parsed = JSON.parse(responseText) as { error?: { message?: string } | string };
			if (typeof parsed.error === "string") return `Airtable API error (${status}): ${parsed.error}`;
			if (parsed.error?.message) return `Airtable API error (${status}): ${parsed.error.message}`;
		} catch {
			// Keep raw text fallback.
		}
		return `Airtable API error (${status}): ${responseText}`;
	}
}
