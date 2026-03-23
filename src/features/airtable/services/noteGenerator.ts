import { App, TFile, Notice, normalizePath } from "obsidian";
import type { AirtableRecord } from "../../../airtable";
import type { TableData } from "./airtableService";

interface TemplateValueObject {
	name?: string;
	url?: string;
	filename?: string;
}

function cleanFileName(name: string): string {
    // 1. Remove "folder" prefixes like "be/", "do/"
    const segments = name.split('/');
    let clean = segments[segments.length - 1];

    // 2. Remove illegal characters for Windows/Unix
    clean = clean.replace(/[\\:*?"<>|]/g, '').trim();
    return clean;
}


export class NoteGenerator {
    constructor(private app: App) {}

    async createNote(
        record: AirtableRecord,
        tableData: TableData,
        baseId: string,
        templatePath: string,
        folderPath: string
    ): Promise<void> {
        try {
            // 1. Determine Filename (Sanitized Primary Field)
            const primaryFieldId = tableData.primaryFieldId;
            const primaryFieldName = tableData.fields.find((field) => field.id === primaryFieldId)?.name || "Name";
            const rawName = record.fields[primaryFieldName] || tableData.fields[0]?.name || "Untitled Record";
            const sanitizedNameRaw = String(rawName).replace(/[\\/:*?"<>|]/g, "").trim();
            const tableNamePart = tableData.name ? `${tableData.name}` : "";
            const sanitizedTableName = cleanFileName(tableNamePart);

            const sanitizedName = `${sanitizedTableName} - ${sanitizedNameRaw}`.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim();

            // Ensure folder exists
            const normalizedFolder = normalizePath(folderPath);
            if (!await this.app.vault.adapter.exists(normalizedFolder)) {
                await this.app.vault.createFolder(normalizedFolder);
            }
            const targetPath = normalizePath(`${normalizedFolder}/${sanitizedName}.md`);

            async function fetchExistingFile(): Promise<TFile | null> {
                const files = this.app.vault.getFiles();
                for (const file of files) {
                    if (file.extension !== "md") continue;
                    const cache = this.app.metadataCache.getFileCache(file);
                    const frontmatter = cache?.frontmatter;
                    if (frontmatter?.uuid === record.id) {
                        return file;
                    }
                }
                return null;
            }

            const fetchedPath = await fetchExistingFile.call(this);
            // Check if exists
            if (fetchedPath) {

                // // Open existing
                // const existingFile = this.app.vault.getAbstractFileByPath(targetPath);
                // if (existingFile instanceof TFile) {
                //     await this.app.workspace.getLeaf(false).openFile(existingFile);
                // }
                // return;
                // Open existing
                await this.app.workspace.getLeaf(false).openFile(fetchedPath);
                return
            }

            // 2. Prepare Content from Template
            let content = "";
            const templateFile = this.app.vault.getAbstractFileByPath(normalizePath(templatePath));

            if (templateFile instanceof TFile) {
                content = await this.app.vault.read(templateFile);
            } else {
                // Fallback content if template missing
                content = `# ${sanitizedName}\n\nData from Airtable.`;
            }

            // 3. Process Template Placeholders {{FieldName}}
            // We iterate over the record fields and replace them in the content
            Object.entries(record.fields).forEach(([key, value]) => {
                const displayValue = formatTemplateValue(value);
                // Regex to replace {{Key}} globally
                const regex = new RegExp(`{{${this.escapeRegExp(key)}}}`, "g");
                content = content.replace(regex, displayValue);
            });

            // 4. Inject/Merge Frontmatter
            // We require specific keys for the plugin to work
            const requiredFrontmatter = [
                `uuid: ${record.id}`,
                `airtable_table_id: ${tableData.id}`,
                `airtable_url: https://airtable.com/${baseId}${tableData.id}/${record.id}`
            ].join("\n");

            if (content.startsWith("---")) {
                // Insert into existing frontmatter
                const endOfFrontmatter = content.indexOf("---", 3);
                if (endOfFrontmatter !== -1) {
                    content = content.slice(0, endOfFrontmatter) + requiredFrontmatter + "\n" + content.slice(endOfFrontmatter);
                } else {
                    // Malformed frontmatter, prepend new block
                    content = `---\n${requiredFrontmatter}\n---\n\n` + content;
                }
            } else {
                // No frontmatter, prepend new block
                content = `---\n${requiredFrontmatter}\n---\n\n` + content;
            }

            // 5. Create and Open
            const newFile = await this.app.vault.create(targetPath, content);
            new Notice(`Created ${sanitizedName}.`);
            await this.app.workspace.getLeaf(false).openFile(newFile);

		} catch (error: unknown) {
			new Notice(`Error creating note: ${getErrorMessage(error)}`);
		}
	}

    private escapeRegExp(string: string): string {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

function formatTemplateValue(value: unknown): string {
	if (Array.isArray(value)) {
		return value.map((item) => formatTemplateValue(item)).join(", ");
	}
	if (isTemplateValueObject(value)) {
		return value.name || value.url || value.filename || JSON.stringify(value);
	}
	return String(value);
}

function isTemplateValueObject(value: unknown): value is TemplateValueObject & Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}
	return "Unknown error";
}
