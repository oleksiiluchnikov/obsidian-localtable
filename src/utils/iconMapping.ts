export function getFieldTypeIcon(type: string): string {
	const iconMap: { [key: string]: string } = {
		singleLineText: "type",
		multilineText: "align-left",
		number: "hash",
		percent: "percent",
		currency: "dollar-sign",
		singleSelect: "circle-dot",
		multipleSelects: "list-checks",
		date: "calendar",
		dateTime: "clock",
		checkbox: "check-square",
		url: "link",
		email: "mail",
		phone: "phone",
		attachment: "paperclip",
		multipleRecordLinks: "git-branch",
		formula: "function-square",
		rollup: "sigma",
		count: "calculator",
		lookup: "search",

		createdTime: "calendar-plus",
		lastModifiedTime: "calendar-clock",
		createdBy: "user-plus",
		lastModifiedBy: "user-check",
		barcode: "scan-line",
		button: "square-mouse-pointer",
		rating: "star" // Add this
	};
	return iconMap[type] || "circle";
}
