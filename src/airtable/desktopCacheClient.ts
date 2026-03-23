import { Platform, requestUrl } from "obsidian";

import {
	LOCALTABLE_HTTP_URL,
	buildDaemonRecordsPath,
	buildDaemonSearchPath,
	normalizeRecord,
	parseDaemonRecordsResponse,
	parseObjectResponse,
	parseSearchRecordsResponse,
} from "./helpers";
import type { AirtableRecord, FetchOptions, SearchOptions, SearchRecordsResult } from "./types";

const AVAILABLE_TTL_MS = 60_000;
const UNAVAILABLE_TTL_MS = 10_000;

/** Optional desktop-only localtable adapter over requestUrl. */
export class DesktopCacheClient {
	private available: boolean | null = null;
	private availableAt = 0;

	async isAvailable(apiKey: string): Promise<boolean> {
		if (!Platform.isDesktopApp) return false;

		const now = Date.now();
		const ttl = this.available ? AVAILABLE_TTL_MS : UNAVAILABLE_TTL_MS;
		if (this.available !== null && now - this.availableAt < ttl) {
			return this.available;
		}

		try {
			await this.requestJson("/_local/health", apiKey);
			this.available = true;
		} catch {
			this.available = false;
		}

		this.availableAt = Date.now();
		return this.available;
	}

	resetAvailability(): void {
		this.available = null;
		this.availableAt = 0;
	}

	async getRecords(
		baseId: string,
		tableId: string,
		apiKey: string,
		options: FetchOptions = {},
	): Promise<{ records: import("./types").AirtableRecord[]; offset?: string }> {
		return parseDaemonRecordsResponse(
			await this.requestJson(
				buildDaemonRecordsPath(baseId, tableId, options),
				apiKey,
				"GET",
				undefined,
				buildReadHeaders(options),
			),
		);
	}

	async getRecord(
		baseId: string,
		tableId: string,
		recordId: string,
		apiKey: string,
	): Promise<AirtableRecord> {
		return normalizeRecord(
			await this.requestJson(`/v0/${baseId}/${tableId}/${recordId}`, apiKey),
		);
	}

	async searchRecords(
		baseId: string,
		tableId: string,
		queryText: string,
		apiKey: string,
		options: SearchOptions = {},
	): Promise<SearchRecordsResult> {
		return parseSearchRecordsResponse(
			await this.requestJson(buildDaemonSearchPath(baseId, tableId, queryText, options), apiKey),
			queryText,
		);
	}

	async invalidate(baseId: string, tableId: string, apiKey: string): Promise<void> {
		await this.requestJson(`/_local/cache/bases/${baseId}/tables/${tableId}`, apiKey, "DELETE");
	}

	async clear(scope: string, apiKey: string): Promise<void> {
		await this.requestJson("/_local/cache/clear", apiKey, "POST", { scope });
	}

	async getSchema(baseId: string, apiKey: string): Promise<Record<string, unknown>> {
		return parseObjectResponse(
			await this.requestJson(`/v0/meta/bases/${baseId}/tables`, apiKey),
			"Invalid localtable schema response",
		);
	}

	async getBaseMetadata(baseId: string, apiKey: string): Promise<Record<string, unknown>> {
		return parseObjectResponse(
			await this.requestJson(`/v0/meta/bases/${baseId}`, apiKey),
			"Invalid localtable metadata response",
		);
	}

	private async requestJson(
		path: string,
		apiKey: string,
		method: string = "GET",
		body?: unknown,
		extraHeaders?: Record<string, string>,
	): Promise<unknown> {
		const response = await requestUrl({
			url: `${LOCALTABLE_HTTP_URL}${path}`,
			method,
			headers: {
				"Content-Type": "application/json",
				...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
				...(extraHeaders ?? {}),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
			throw: false,
		});

		if (response.status >= 400) {
			this.available = false;
			this.availableAt = Date.now();
			throw new Error(response.text || `localtable error (${response.status})`);
		}

		return response.json;
	}
}

function buildReadHeaders(options: FetchOptions): Record<string, string> {
	const headers: Record<string, string> = {};
	if (options.forceRefresh) headers["X-Localtable-Cache-Control"] = "bypass";
	if (options.resolveLinks) headers["X-Localtable-Resolve-Links"] = "true";
	return headers;
}
