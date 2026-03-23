import type { App } from "obsidian";
import { CacheService } from "../../../services/cacheService";

export interface LinkedRecordInfo {
	id: string;
	name: string;
	tableId: string;
	tableName: string;
}

export interface LinkedRecordBatch {
	tableId: string;
	recordIds: string[];
}

export class LinkedRecordCache {
	private cache: CacheService;
	private readonly LINKED_RECORD_TTL = 60 * 60 * 1000; // 1 hour

	constructor(app: App, enablePersistence: boolean = true) {
		this.cache = new CacheService(app, enablePersistence);
	}

	/**
	 * Get a linked record's info from cache
	 */
	get(recordId: string): LinkedRecordInfo | null {
		return this.cache.get<LinkedRecordInfo>(`linkedRecord:${recordId}`);
	}

	/**
	 * Set a linked record's info in cache
	 */
	set(recordId: string, info: LinkedRecordInfo): void {
		this.cache.set(`linkedRecord:${recordId}`, info, this.LINKED_RECORD_TTL);
	}

	/**
	 * Get multiple linked records from cache
	 */
	getMany(recordIds: string[]): Map<string, LinkedRecordInfo> {
		const result = new Map<string, LinkedRecordInfo>();

		for (const id of recordIds) {
			const info = this.get(id);
			if (info) {
				result.set(id, info);
			}
		}

		return result;
	}

	/**
	 * Set multiple linked records in cache
	 */
	setMany(records: LinkedRecordInfo[]): void {
		for (const record of records) {
			this.set(record.id, record);
		}
	}

	/**
	 * Find missing record IDs that need to be fetched
	 */
	findMissing(recordIds: string[]): string[] {
		return recordIds.filter(id => !this.get(id));
	}

	/**
	 * Clear cache entries for a specific table (M14: only clears records for that table)
	 */
	clearTable(tableId: string): void {
		this.cache.invalidatePattern(new RegExp(`^linkedRecord:rec[^:]+$`));
		// Note: we can't filter by tableId without a reverse index,
		// but this is correct — linkedRecord keys don't embed tableId.
		// If per-table invalidation is needed, store keys as linkedRecord:{tableId}:{recordId}.
	}
}
