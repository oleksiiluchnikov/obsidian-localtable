import {
	AirtableDirectClient,
	DesktopCacheClient,
	type AirtableRecord,
	type BatchUpdateItem,
	type CreateFieldPayload,
	type FetchOptions,
	type MutationOptions,
	type SearchOptions,
	type SearchRecordsResult,
} from "../airtable";

export type {
	AirtableRecord,
	BatchUpdateItem,
	CreateFieldPayload,
	FetchOptions,
	MutationOptions,
	SearchOptions,
	SearchRecordsResult,
};

/**
 * Plugin-facing Airtable gateway.
 *
 * Canonical path is direct Airtable over requestUrl for mobile safety.
 * Optional desktop localtable reads are attempted first when available.
 */
export class AirtableClient {
	private readonly directClient = new AirtableDirectClient();
	private readonly desktopCacheClient = new DesktopCacheClient();
	private lastApiKey = "";

	async isAvailable(): Promise<boolean> {
		return this.isDaemonAvailable();
	}

	async isDaemonAvailable(): Promise<boolean> {
		return this.desktopCacheClient.isAvailable(this.lastApiKey);
	}

	resetAvailability(): void {
		this.desktopCacheClient.resetAvailability();
	}

	async getRecords(
		baseId: string,
		tableId: string,
		apiKey: string,
		options: FetchOptions = {},
	): Promise<{ records: AirtableRecord[]; offset?: string }> {
		this.rememberApiKey(apiKey);

		if (!options.skipDaemon && await this.desktopCacheClient.isAvailable(apiKey)) {
			try {
				return await this.desktopCacheClient.getRecords(baseId, tableId, apiKey, options);
			} catch {
				this.desktopCacheClient.resetAvailability();
			}
		}

		return {
			records: await this.directClient.getRecords(baseId, tableId, apiKey, options),
		};
	}

	async invalidate(baseId: string, tableId: string): Promise<void> {
		if (!this.lastApiKey) return;
		try {
			await this.desktopCacheClient.invalidate(baseId, tableId, this.lastApiKey);
		} catch {
			// Optional desktop cache only.
		}
	}

	async setRecords(): Promise<void> {
		// The plugin does not write directly into localtable.
	}

	async clear(scope: string = "all"): Promise<void> {
		if (!this.lastApiKey) return;
		try {
			await this.desktopCacheClient.clear(scope, this.lastApiKey);
		} catch {
			// Optional desktop cache only.
		}
	}

	async createRecord(
		baseId: string,
		tableId: string,
		fields: Record<string, unknown>,
		apiKey: string = this.lastApiKey,
		options: MutationOptions = {},
	): Promise<AirtableRecord> {
		this.rememberApiKey(apiKey);
		const record = await this.directClient.createRecord(baseId, tableId, fields, apiKey, options);
		await this.invalidate(baseId, tableId);
		return record;
	}

	async createRecords(
		baseId: string,
		tableId: string,
		fieldsList: Record<string, unknown>[],
		apiKey: string = this.lastApiKey,
		options: MutationOptions = {},
	): Promise<AirtableRecord[]> {
		this.rememberApiKey(apiKey);
		const records = await this.directClient.createRecords(baseId, tableId, fieldsList, apiKey, options);
		await this.invalidate(baseId, tableId);
		return records;
	}

	async updateRecord(
		baseId: string,
		tableId: string,
		recordId: string,
		fields: Record<string, unknown>,
		apiKey: string = this.lastApiKey,
		options: MutationOptions = {},
	): Promise<AirtableRecord> {
		this.rememberApiKey(apiKey);
		const record = await this.directClient.updateRecord(baseId, tableId, recordId, fields, apiKey, options);
		await this.invalidate(baseId, tableId);
		return record;
	}

	async updateRecords(
		baseId: string,
		tableId: string,
		updates: BatchUpdateItem[],
		apiKey: string = this.lastApiKey,
		options: MutationOptions = {},
	): Promise<AirtableRecord[]> {
		this.rememberApiKey(apiKey);
		const records = await this.directClient.updateRecords(baseId, tableId, updates, apiKey, options);
		await this.invalidate(baseId, tableId);
		return records;
	}

	async deleteRecord(baseId: string, tableId: string, recordId: string, apiKey: string = this.lastApiKey): Promise<void> {
		this.rememberApiKey(apiKey);
		await this.directClient.deleteRecord(baseId, tableId, recordId, apiKey);
		await this.invalidate(baseId, tableId);
	}

	async searchRecords(
		baseId: string,
		tableId: string,
		query: string,
		options: SearchOptions = {},
	): Promise<SearchRecordsResult> {
		return this.desktopCacheClient.searchRecords(baseId, tableId, query, this.lastApiKey, options);
	}

	async getSchema(baseId: string, apiKey: string = this.lastApiKey): Promise<Record<string, unknown>> {
		this.rememberApiKey(apiKey);
		if (await this.desktopCacheClient.isAvailable(apiKey)) {
			try {
				return await this.desktopCacheClient.getSchema(baseId, apiKey);
			} catch {
				this.desktopCacheClient.resetAvailability();
			}
		}
		return this.directClient.getSchema(baseId, apiKey);
	}

	async getBaseMetadata(baseId: string, apiKey: string = this.lastApiKey): Promise<Record<string, unknown>> {
		this.rememberApiKey(apiKey);
		if (await this.desktopCacheClient.isAvailable(apiKey)) {
			try {
				return await this.desktopCacheClient.getBaseMetadata(baseId, apiKey);
			} catch {
				this.desktopCacheClient.resetAvailability();
			}
		}
		return this.directClient.getBaseMetadata(baseId, apiKey);
	}

	async getRecord(baseId: string, tableId: string, recordId: string, apiKey: string = this.lastApiKey): Promise<AirtableRecord> {
		this.rememberApiKey(apiKey);
		if (await this.desktopCacheClient.isAvailable(apiKey)) {
			try {
				return await this.desktopCacheClient.getRecord(baseId, tableId, recordId, apiKey);
			} catch {
				this.desktopCacheClient.resetAvailability();
			}
		}
		return this.directClient.getRecord(baseId, tableId, recordId, apiKey);
	}

	async createField(
		baseId: string,
		tableId: string,
		payload: CreateFieldPayload,
		apiKey: string = this.lastApiKey,
	): Promise<Record<string, unknown>> {
		this.rememberApiKey(apiKey);
		return this.directClient.createField(baseId, tableId, payload, apiKey);
	}

	private rememberApiKey(apiKey: string): void {
		if (apiKey) {
			this.lastApiKey = apiKey;
		}
	}
}

export const cacheClient = new AirtableClient();
