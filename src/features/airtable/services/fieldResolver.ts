import type { AirtableRecord } from "../../../airtable";
import type { Field, TableData } from "./airtableService";
import type { LinkedRecordInfo } from "./linkedRecordCache";

interface AttachmentThumbnail {
	url: string;
}

interface AttachmentValue {
	filename?: string;
	url?: string;
	thumbnails?: {
		small?: AttachmentThumbnail;
	};
}

interface ButtonValue {
	label?: string;
	url?: string;
}

export interface ResolvedValue {
    type: string;
    displayValue: string;
    rawValue: unknown;
    metadata?: {
        linkedRecords?: LinkedRecordInfo[];
        isComputed?: boolean;
    };
}

export class FieldResolver {
    private linkedRecordMap: Map<string, LinkedRecordInfo> = new Map();

    constructor(private tableData: TableData) {
		if (tableData.resolvedLinkedRecords) {
			for (const map of tableData.resolvedLinkedRecords.values()) {
				for (const [id, info] of map) {
					this.linkedRecordMap.set(id, info);
				}
			}
		}
	}

    getFieldByName(fieldName: string): Field | undefined {
        return this.tableData.fields.find((field) => field.name === fieldName);
    }

    getTableName(): string {
        return this.tableData.name;
    }

    resolve(fieldId: string, value: unknown): ResolvedValue {
        const field = this.tableData.fields.find((currentField) => currentField.id === fieldId);
        if (!field) return this.formatDefault(value);
        if (value == null) return { type: field.type, displayValue: "—", rawValue: null };

        switch (field.type) {
            case "multipleRecordLinks":
                if (isLinkedRecordIdArray(value)) {
                    return this.resolveLinks(value);
                }
                return this.formatDefault(value);
            case "lookup":
            case "rollup":
            case "multipleLookupValues":  // ✅ ADD THIS

                // If value looks like Links (array of "rec...")
                if (isLinkedRecordIdArray(value)) {
                    return this.resolveLinks(value);
                }
                // If value looks like Attachments
                if (isAttachmentArray(value)) {
                    return this.resolveAttachments(value);
                }
                return this.formatDefault(value, true);

            case "attachment":
                if (isAttachmentArray(value)) {
                    return this.resolveAttachments(value);
                }
                return this.formatDefault(value);
            case "checkbox":
                return { type: "checkbox", displayValue: value ? "✓" : "", rawValue: value };
            case "button":
                const button = isButtonValue(value) ? value : {};
                return {
                    type: "button",
                    displayValue: button.label || "Button",
                    rawValue: button
                };

            default:
                return this.formatDefault(value);
        }
    }



    private resolveLinks(ids: string | string[]): ResolvedValue {
        const arr = Array.isArray(ids) ? ids : [ids];
        const resolved: LinkedRecordInfo[] = [];
        const unresolved: string[] = [];

        arr.forEach((id) => {
            if (id.startsWith("rec")) {
                const info = this.linkedRecordMap.get(id);
                if (info) {
                    resolved.push(info);
                } else {
                    unresolved.push(id);
                }
            }
        });

        let label = "—";
        if (resolved.length > 0) {
            label = resolved.map(r => r.name).join(", ");
            if (unresolved.length > 0) label += ` (+${unresolved.length})`;
        } else if (unresolved.length > 0) {
            label = `${unresolved.length} linked record${unresolved.length > 1 ? 's' : ''}`;
        }

        return {
            type: "linkedRecords",
            displayValue: label,
            rawValue: ids,
            metadata: { linkedRecords: resolved.length > 0 ? resolved : undefined }
        };
    }

    private resolveAttachments(files: AttachmentValue[]): ResolvedValue {
        return {
            type: "attachment",
            displayValue: `${files.length} attachment${files.length > 1 ? 's' : ''}`,
            rawValue: files
        };
    }

    private formatDefault(value: unknown, isComputed = false): ResolvedValue {
        let display = "";
        if (Array.isArray(value)) {
            // Prevent [object Object] by mapping properly
            display = value.map((item) => {
                if (isNamedObject(item)) {
                    return item.name || item.filename || JSON.stringify(item);
                }
                return String(item);
            }).join(", ");
        } else if (isNamedObject(value)) {
            display = value.name || value.filename || JSON.stringify(value);
        } else {
            display = String(value);
        }

        return {
            type: "text",
            displayValue: display,
            rawValue: value,
            metadata: { isComputed }
        };
    }

    getFieldName(fieldId: string): string {
        return this.tableData.fields.find((field) => field.id === fieldId)?.name || fieldId;
    }
}

function isNamedObject(value: unknown): value is { name?: string; filename?: string } & Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isButtonValue(value: unknown): value is ButtonValue {
	return typeof value === "object" && value !== null;
}

function isAttachmentArray(value: unknown): value is AttachmentValue[] {
	return Array.isArray(value) && value.some((item) => isAttachmentValue(item));
}

function isAttachmentValue(value: unknown): value is AttachmentValue {
	return typeof value === "object" && value !== null && ("url" in value || "thumbnails" in value || "filename" in value);
}

function isLinkedRecordIdArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.some((item) => typeof item === "string" && item.startsWith("rec"));
}
