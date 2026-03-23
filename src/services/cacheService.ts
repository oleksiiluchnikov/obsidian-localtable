import type { App } from "obsidian";
import { CACHE_STORAGE_KEY, PLUGIN_ID } from "../pluginMeta";

interface CacheEntry<T> {
	data: T;
	timestamp: number;
	ttl: number;
}

interface CacheStorage {
	[key: string]: CacheEntry<any>;
}

export class CacheService {
	private cache: Map<string, CacheEntry<any>>;
	private readonly STORAGE_KEY = CACHE_STORAGE_KEY;
	private saveTimer: ReturnType<typeof setTimeout> | null = null;
	private readonly SAVE_DEBOUNCE_MS = 500;
	// M16: periodic cleanup to prevent unbounded memory growth
	private cleanupTimer: ReturnType<typeof setInterval> | null = null;
	private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // every 5 min

	constructor(
		private app: App,
		private enablePersistence: boolean = false
	) {
		this.cache = new Map();
		if (enablePersistence) {
			this.loadFromStorage().catch(() => undefined);
		}
		// M16: schedule periodic cleanup
		this.cleanupTimer = setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL_MS);
	}

	// H3: cancel all pending timers — call from AirtableService teardown
	dispose(): void {
		if (this.saveTimer !== null) {
			clearTimeout(this.saveTimer);
			this.saveTimer = null;
		}
		if (this.cleanupTimer !== null) {
			clearInterval(this.cleanupTimer);
			this.cleanupTimer = null;
		}
	}

	/**
	 * Set cache with TTL (time to live)
	 * @param key - Cache key (e.g., "table:appXXX:tblYYY")
	 * @param data - Data to cache
	 * @param ttl - Time to live in milliseconds (default: 5 min)
	 */
	set<T>(key: string, data: T, ttl: number = 5 * 60 * 1000): void {
		const entry: CacheEntry<T> = {
			data,
			timestamp: Date.now(),
			ttl,
		};

		this.cache.set(key, entry);

		if (this.enablePersistence) {
			this.scheduleSave();
		}
	}

	/**
	 * Get cached data (returns null if expired or not found)
	 */
	get<T>(key: string): T | null {
		const entry = this.cache.get(key);
		if (!entry) return null;

		// Check if expired
		const age = Date.now() - entry.timestamp;
		if (age > entry.ttl) {
			this.cache.delete(key);
			if (this.enablePersistence) {
				this.scheduleSave();
			}
			return null;
		}

		return entry.data as T;
	}

	/**
	 * Check if cache has valid (non-expired) entry
	 */
	has(key: string): boolean {
		return this.get(key) !== null;
	}

	/**
	 * Invalidate specific cache entry
	 */
	invalidate(key: string): void {
		this.cache.delete(key);
		if (this.enablePersistence) {
			this.scheduleSave();
		}
	}

	/**
	 * Invalidate all cache entries matching pattern
	 */
	invalidatePattern(pattern: RegExp): void {
		const keysToDelete: string[] = [];

		this.cache.forEach((_, key) => {
			if (pattern.test(key)) {
				keysToDelete.push(key);
			}
		});

		keysToDelete.forEach(key => this.cache.delete(key));

		if (this.enablePersistence) {
			this.scheduleSave();
		}
	}

	/**
	 * Clear all cache
	 */
	clear(): void {
		this.cache.clear();
		if (this.enablePersistence) {
			this.scheduleSave();
		}
	}

	/**
	 * Get cache stats
	 */
	getStats() {
		let validEntries = 0;
		let expiredEntries = 0;
		let totalSize = 0;

		this.cache.forEach((entry, key) => {
			const age = Date.now() - entry.timestamp;
			if (age > entry.ttl) {
				expiredEntries++;
			} else {
				validEntries++;
			}
			totalSize += JSON.stringify(entry.data).length;
		});

		return {
			validEntries,
			expiredEntries,
			totalSize,
			totalEntries: this.cache.size,
		};
	}

	/**
	 * Clean up expired entries
	 */
	cleanup(): void {
		const keysToDelete: string[] = [];
		const now = Date.now();

		this.cache.forEach((entry, key) => {
			if (now - entry.timestamp > entry.ttl) {
				keysToDelete.push(key);
			}
		});

		keysToDelete.forEach(key => this.cache.delete(key));

		if (this.enablePersistence && keysToDelete.length > 0) {
			this.scheduleSave();
		}
	}

	// Private: Load cache from Obsidian's data storage
	private async loadFromStorage(): Promise<void> {
		try {
			const data = await this.app.vault.adapter.read(
				`${this.app.vault.configDir}/plugins/${PLUGIN_ID}/${this.STORAGE_KEY}.json`
			);
			const storage: CacheStorage = JSON.parse(data);

			Object.entries(storage).forEach(([key, entry]) => {
				this.cache.set(key, entry);
			});

			// Clean up expired entries after load
			this.cleanup();
		} catch {
			// Cache file doesn't exist or is corrupted - start fresh
		}
	}

	// Private: Schedule a debounced save so rapid successive writes (e.g. after
	// invalidatePattern + invalidate) produce only one disk write.
	private scheduleSave(): void {
		if (this.saveTimer !== null) clearTimeout(this.saveTimer);
		this.saveTimer = setTimeout(() => {
			this.saveTimer = null;
			this.saveToStorage();
		}, this.SAVE_DEBOUNCE_MS);
	}

	// Private: Save cache to Obsidian's data storage
	private async saveToStorage(): Promise<void> {
		try {
			const storage: CacheStorage = {};

			this.cache.forEach((entry, key) => {
				storage[key] = entry;
			});

			const dir = `${this.app.vault.configDir}/plugins/${PLUGIN_ID}`;

			// Ensure directory exists
			if (!await this.app.vault.adapter.exists(dir)) {
				await this.app.vault.adapter.mkdir(dir);
			}

			await this.app.vault.adapter.write(
				`${dir}/${this.STORAGE_KEY}.json`,
				JSON.stringify(storage, null, 2)
			);
		} catch {
			// Best-effort persistence only.
		}
	}
}

// Helper: Generate cache keys
// Note: record caching has been removed — records are now cached entirely by
// the daemon (L1/L2 with stale-while-revalidate).  CacheService is for UI-only
// state such as schema info and column/view preferences.
export const CacheKeys = {
	tableInfo: (baseId: string, tableId: string) => `table:${baseId}:${tableId}`,
	basePattern: (baseId: string) => new RegExp(`^.*:${baseId}:.*$`),
	tablePattern: (baseId: string, tableId: string) => new RegExp(`^.*:${baseId}:${tableId}$`),
};
