import { App, TFile, Notice } from "obsidian";
import type { TableData } from "./airtableService";
import { cacheClient, type CreateFieldPayload } from "../../../services/cacheClient";

export class LinkSyncService {
    constructor(private app: App) {}

    /**
     * Generate a standard Obsidian URI for a vault file.
     */
    generateNoteUri(file: TFile): string {
        const vault = this.app.vault.getName();
        return `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(file.path)}`;
    }

    /**
     * Create Airtable field if it doesn't exist
     */
    async createField(
        tableId: string,
        fieldName: string,
        fieldType: "url" | "singleLineText",
        apiKey: string,
        baseId: string,
        description?: string
	): Promise<boolean> {
		try {
			const body: CreateFieldPayload = {
				name: fieldName,
				type: fieldType
			};

			if (description) {
				body.description = description;
			}

			const result = await cacheClient.createField(baseId, tableId, body, apiKey);
			void result;
			return true;

		} catch (error) {
			throw error;
		}
    }

    /**
     * Check if field exists in table, create it if it doesn't
     */
    async ensureFieldExists(
        tableData: TableData,
        fieldName: string,
        apiKey: string,
        baseId: string,
        autoCreate: boolean = true
    ): Promise<boolean> {
        const field = tableData.fields.find(f => f.name === fieldName);

        if (!field) {
            if (!autoCreate) {
                new Notice(
                    `Field "${fieldName}" was not found. Create it manually in Airtable as a URL field.`,
                    8000
                );
                return false;
            }

            // Attempt to create the field
            new Notice(`Creating field "${fieldName}"...`, 3000);

            try {
                await this.createField(
                    tableData.id,
                    fieldName,
                    "url", // URL type for clickable links
                    apiKey,
                    baseId,
                    "Link to Obsidian note (auto-generated)"
                );

                new Notice(`Created field "${fieldName}".`, 4000);
                return true;

            } catch (error) {
				new Notice(
					`Failed to create field: ${error.message}`,
					8000
				);
                return false;
            }
        }

        // Validate field type
        const compatibleTypes = ['url', 'singleLineText', 'multilineText'];
        if (!compatibleTypes.includes(field.type)) {
            new Notice(
                `Field "${fieldName}" is type "${field.type}". Expected a URL or text field.`,
                6000
            );
            return false;
        }

        return true;
    }

    /**
     * Update Airtable record with Obsidian link
     */
    async updateRecordLink(
        recordId: string,
        tableId: string,
        fieldName: string,
        linkUrl: string,
        apiKey: string,
        baseId: string
    ): Promise<boolean> {
        try {
            await cacheClient.updateRecord(
                baseId,
                tableId,
                recordId,
                {
                    [fieldName]: linkUrl
                },
                apiKey,
            );

            return true;
		} catch (error) {
			throw error;
        }
    }

	async syncFile(
		file: TFile,
		apiKey: string,
		baseId: string,
		fieldName: string,
	): Promise<boolean> {
		const cache = this.app.metadataCache.getFileCache(file);
		const frontmatter = cache?.frontmatter;

		if (!frontmatter?.uuid || !String(frontmatter.uuid).startsWith("rec")) {
			return false;
		}

		if (!frontmatter?.airtable_table_id) {
			return false;
		}

		try {
			await this.updateRecordLink(
				String(frontmatter.uuid),
				String(frontmatter.airtable_table_id),
				fieldName,
				this.generateNoteUri(file),
				apiKey,
				baseId,
			);
			return true;
		} catch (error: unknown) {
			new Notice(`Failed to sync renamed note: ${error instanceof Error ? error.message : "Unknown error"}`);
			return false;
		}
	}

    /**
     * Sync current note's link to Airtable
     */
    async syncCurrentNote(
        apiKey: string,
        baseId: string,
        fieldName: string,
        tableData?: TableData,
        autoCreateField: boolean = true,
    ): Promise<void> {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            new Notice("No active file");
            return;
        }

        const cache = this.app.metadataCache.getFileCache(activeFile);
        const frontmatter = cache?.frontmatter;

        if (!frontmatter?.uuid || !frontmatter.uuid.startsWith('rec')) {
            new Notice("Note doesn't have a valid Airtable UUID");
            return;
        }

        if (!frontmatter?.airtable_table_id) {
            new Notice("Note missing airtable_table_id");
            return;
        }

        const recordId = frontmatter.uuid;
        const tableId = frontmatter.airtable_table_id;
        const linkUrl = this.generateNoteUri(activeFile);

        // Ensure field exists (with auto-create if tableData provided)
        if (tableData) {
            const fieldExists = await this.ensureFieldExists(
                tableData,
                fieldName,
                apiKey,
                baseId,
                autoCreateField
            );

            if (!fieldExists) return;
        }

        try {
            await this.updateRecordLink(recordId, tableId, fieldName, linkUrl, apiKey, baseId);
            new Notice(`Synced ${activeFile.basename}.`);
        } catch (error) {
            new Notice(`Failed to sync link: ${error.message}`);
        }
    }

    /**
     * Batch sync links for multiple records
     */
    async batchSyncLinks(
        recordFileMap: Map<string, TFile>,
        tableData: TableData,
        fieldName: string,
        apiKey: string,
        baseId: string,
        autoCreateField: boolean,
        onProgress?: (current: number, total: number) => void
    ): Promise<{ success: number; failed: number }> {
        if (recordFileMap.size === 0) {
            return { success: 0, failed: 0 };
        }

        // Ensure field exists before batch operation
        const fieldExists = await this.ensureFieldExists(
            tableData,
            fieldName,
            apiKey,
            baseId,
            autoCreateField
        );

        if (!fieldExists) {
            return { success: 0, failed: recordFileMap.size };
        }

        let success = 0;
        let failed = 0;
        const total = recordFileMap.size;

        for (const [recordId, file] of recordFileMap) {
            try {
                const cache = this.app.metadataCache.getFileCache(file);
                const tableId = cache?.frontmatter?.airtable_table_id || tableData.id;
                const linkUrl = this.generateNoteUri(file);

                await this.updateRecordLink(
                    recordId,
                    tableId,
                    fieldName,
                    linkUrl,
                    apiKey,
                    baseId
                );
                success++;

                onProgress?.(success + failed, total);

                // Rate limiting
                if (success + failed < total) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
			} catch {
				failed++;
				onProgress?.(success + failed, total);
			}
        }

        return { success, failed };
    }
}
