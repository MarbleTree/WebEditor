class WysiwygEditor {

    constructor(rootElement, dotNetRef, initialHtml) {

        this.rootElement = rootElement;
        this.dotNetRef = dotNetRef;
        this.blockIdSequence = 0;
        this.savedRange = null;

        this.editorElement =
            this.rootElement.querySelector("[data-role='editor']");

        this.htmlOutputElement =
            this.rootElement.querySelector("[data-role='html-output']");

        this.jsonOutputElement =
            this.rootElement.querySelector("[data-role='json-output']");

        if (this.editorElement && initialHtml) {
            this.editorElement.innerHTML = initialHtml;
        }

        this.initializeToolbar();
        this.initializeEvents();

        this.updateOutputs();
    }


    initializeToolbar() {

        const toolbar = this.rootElement?.querySelector(".toolbar");

        if (!toolbar) {
            return;
        }

        toolbar.addEventListener("mousedown", event => {
            const button = event.target?.closest("button");

            if (!button || !toolbar.contains(button)) {
                return;
            }

            event.preventDefault();
        });

        toolbar.addEventListener("click", event => {
            const button = event.target?.closest("button");

            if (!button || !toolbar.contains(button)) {
                return;
            }

            event.preventDefault();

            const command = button.dataset.command;

            if (command) {
                this.executeCommand(command);
                return;
            }

            const block = button.dataset.block;

            if (block) {
                this.formatBlock(block);
                return;
            }

            const action = button.dataset.action;

            switch (action) {
                case "create-link":
                    this.createLink();
                    break;
                case "edit-link":
                    this.editLink();
                    break;
                case "remove-link":
                    this.removeLink();
                    break;
                case "insert-table":
                    this.insertTable();
                    break;
                case "insert-row":
                    this.insertRow();
                    break;
                case "remove-row":
                    this.removeRow();
                    break;
                case "insert-column":
                    this.insertColumn();
                    break;
                case "remove-column":
                    this.removeColumn();
                    break;
                case "clear-formatting":
                    this.clearFormatting();
                    break;
                default:
                    break;
            }
        });
    }


    initializeEvents() {

        this.editorElement?.addEventListener(
            "input",
            () => {
                this.rememberSelection();
                this.updateOutputs();
            }
        );

        this.editorElement?.addEventListener("mouseup", () => this.rememberSelection());
        this.editorElement?.addEventListener("keyup", () => this.rememberSelection());
        this.editorElement?.addEventListener("focusin", () => this.rememberSelection());
    }


    executeCommand(command) {

        if (!command) {
            return;
        }

        document.execCommand(command);

        if (command === "insertUnorderedList" || command === "insertOrderedList") {
            this.normalizeListMarkup();
        }

        this.editorElement?.focus();

        this.updateOutputs();
    }


    normalizeListMarkup() {

        if (!this.editorElement) {
            return;
        }

        this.editorElement
            .querySelectorAll("li > h1, li > h2, li > h3, li > h4, li > h5, li > h6")
            .forEach(heading => {
                const parent = heading.parentNode;

                while (heading.firstChild) {
                    parent.insertBefore(heading.firstChild, heading);
                }

                heading.remove();
            });

        this.editorElement
            .querySelectorAll("[style]")
            .forEach(element => {
                if (!element.style.fontSize) {
                    return;
                }

                element.style.fontSize = "";

                const style = element.getAttribute("style")?.trim();

                if (!style) {
                    element.removeAttribute("style");
                }
            });
    }


    formatBlock(block) {

        if (!block) {
            return;
        }

        document.execCommand("formatBlock", false, block);

        this.editorElement?.focus();

        this.updateOutputs();
    }


    createLink() {

        const url = this.normalizeUrl(prompt("Enter the URL:"));

        if (!url) {
            return;
        }

        document.execCommand("createLink", false, url);

        this.editorElement?.focus();

        this.updateOutputs();
    }


    editLink() {

        const link = this.getActiveLinkElement();
        const currentUrl = link?.getAttribute("href") || "";
        const url = this.normalizeUrl(prompt("Enter the URL:", currentUrl));

        if (url === null) {
            return;
        }

        if (!url) {
            this.removeLink();
            return;
        }

        if (link) {
            link.setAttribute("href", url);
        } else {
            document.execCommand("createLink", false, url);
        }

        this.editorElement?.focus();

        this.updateOutputs();
    }


    removeLink() {

        const link = this.getActiveLinkElement();

        if (link) {
            this.unwrapElement(link);
        } else {
            document.execCommand("unlink");
        }

        this.editorElement?.focus();

        this.updateOutputs();
    }


    insertTable() {

        const rows = this.promptDimension("Rows (1-8):", 2);

        if (rows === null) {
            return;
        }

        const columns = this.promptDimension("Columns (1-8):", 2);

        if (columns === null) {
            return;
        }

        const insertedTable = this.insertTableAtSelection(rows, columns);

        if (insertedTable) {
            this.focusCell(insertedTable.rows?.[0]?.cells?.[0] || null);
        }

        this.updateOutputs();
    }


    insertRow() {

        const cell = this.getSelectedTableCell();

        if (!cell) {
            return;
        }

        const row = cell.parentElement;
        const section = row?.parentElement;

        if (!row || !section) {
            return;
        }

        const newRow = document.createElement("tr");
        const columnCount = Math.max(1, row.cells.length);

        for (let i = 0; i < columnCount; i += 1) {
            newRow.appendChild(this.createEmptyCell());
        }

        section.insertBefore(newRow, row.nextSibling);

        const table = row.closest("table");

        if (table) {
            this.applyTableVisualStyle(table);
        }

        this.focusCell(newRow.cells[0]);

        this.updateOutputs();
    }


    removeRow() {

        const cell = this.getSelectedTableCell();

        if (!cell) {
            return;
        }

        const row = cell.parentElement;
        const section = row?.parentElement;

        if (!row || !section) {
            return;
        }

        if (section.rows.length <= 1) {
            Array.from(row.cells).forEach(currentCell => {
                currentCell.innerHTML = "<br>";
            });

            this.focusCell(row.cells[0]);
            this.updateOutputs();

            return;
        }

        const nextRow = row.nextElementSibling || row.previousElementSibling;
        row.remove();

        const focusTarget = nextRow?.cells?.[0] || null;

        if (focusTarget) {
            this.focusCell(focusTarget);
        }

        this.updateOutputs();
    }


    insertColumn() {

        const cell = this.getSelectedTableCell();

        if (!cell) {
            return;
        }

        const table = cell.closest("table");

        if (!table) {
            return;
        }

        const columnIndex = cell.cellIndex;
        const insertIndex = columnIndex + 1;
        const rowIndex = cell.parentElement?.rowIndex ?? 0;

        Array.from(table.rows).forEach(row => {
            const newCell = this.createEmptyCell();
            const referenceCell = row.cells[insertIndex] || null;

            row.insertBefore(newCell, referenceCell);
        });

        this.applyTableVisualStyle(table);

        this.focusCell(table.rows[rowIndex]?.cells?.[insertIndex] || null);

        this.updateOutputs();
    }


    removeColumn() {

        const cell = this.getSelectedTableCell();

        if (!cell) {
            return;
        }

        const table = cell.closest("table");

        if (!table || table.rows.length === 0) {
            return;
        }

        const columnIndex = cell.cellIndex;
        const maxColumns = Math.max(...Array.from(table.rows).map(row => row.cells.length));

        if (maxColumns <= 1) {
            Array.from(table.rows).forEach(row => {
                if (row.cells[0]) {
                    row.cells[0].innerHTML = "<br>";
                }
            });

            this.focusCell(table.rows[cell.parentElement?.rowIndex ?? 0]?.cells?.[0] || null);
            this.updateOutputs();

            return;
        }

        Array.from(table.rows).forEach(row => {
            if (columnIndex < row.cells.length) {
                row.deleteCell(columnIndex);
            }
        });

        this.applyTableVisualStyle(table);

        const rowIndex = cell.parentElement?.rowIndex ?? 0;
        const nextIndex = Math.max(0, columnIndex - 1);

        this.focusCell(table.rows[rowIndex]?.cells?.[nextIndex] || null);

        this.updateOutputs();
    }


    promptDimension(message, defaultValue) {

        const value = prompt(message, String(defaultValue));

        if (value === null) {
            return null;
        }

        const parsed = Number.parseInt(value.trim(), 10);

        if (!Number.isFinite(parsed) || parsed < 1 || parsed > 8) {
            alert("Please enter a number between 1 and 8.");
            return null;
        }

        return parsed;
    }


    insertTableAtSelection(rows, columns) {

        if (!this.editorElement) {
            return null;
        }

        const table = document.createElement("table");
        const body = document.createElement("tbody");

        for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
            const row = document.createElement("tr");

            for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
                row.appendChild(this.createEmptyCell());
            }

            body.appendChild(row);
        }

        table.appendChild(body);
        this.applyTableVisualStyle(table);

        const trailingParagraph = document.createElement("p");
        trailingParagraph.appendChild(document.createElement("br"));

        const selection = window.getSelection();

        if (!selection) {
            return null;
        }

        this.restoreSelection();

        let range = null;

        if (selection.rangeCount > 0 && this.isInsideEditor(selection.anchorNode)) {
            range = selection.getRangeAt(0);
        } else {
            range = this.createEditorEndRange();
            selection.removeAllRanges();
            selection.addRange(range);
        }

        range.deleteContents();

        const fragment = document.createDocumentFragment();
        fragment.appendChild(table);
        fragment.appendChild(trailingParagraph);

        range.insertNode(fragment);

        return table;
    }


    createEmptyCell() {

        const cell = document.createElement("td");
        cell.appendChild(document.createElement("br"));

        return cell;
    }


    applyTableVisualStyle(table) {

        if (!table) {
            return;
        }

        table.style.borderCollapse = "collapse";
        table.style.width = "100%";
        table.style.margin = "10px 0";

        Array.from(table.rows).forEach(row => {
            Array.from(row.cells).forEach(cell => {
                cell.style.border = "1px solid #ccc";
                cell.style.padding = "6px";
                cell.style.minWidth = "72px";
                cell.style.verticalAlign = "top";
            });
        });
    }


    getSelectedTableCell() {

        const selection = window.getSelection();

        if (!selection || selection.rangeCount === 0) {
            return null;
        }

        const range = selection.getRangeAt(0);

        return this.findClosestTableCell(range.startContainer)
            || this.findClosestTableCell(range.endContainer)
            || this.findClosestTableCell(selection.anchorNode);
    }


    findClosestTableCell(node) {

        let current = node;

        while (current) {
            if (current.nodeType === Node.ELEMENT_NODE) {
                const tag = current.tagName.toUpperCase();

                if (tag === "TD" || tag === "TH") {
                    return this.editorElement?.contains(current) ? current : null;
                }
            }

            current = current.parentNode;
        }

        return null;
    }


    focusCell(cell) {

        if (!cell) {
            return;
        }

        const selection = window.getSelection();

        if (!selection) {
            return;
        }

        const range = document.createRange();
        range.selectNodeContents(cell);
        range.collapse(true);

        selection.removeAllRanges();
        selection.addRange(range);

        this.savedRange = range.cloneRange();

        this.editorElement?.focus();
    }


    rememberSelection() {

        const selection = window.getSelection();

        if (!selection || selection.rangeCount === 0) {
            return;
        }

        if (!this.isInsideEditor(selection.anchorNode)) {
            return;
        }

        this.savedRange = selection.getRangeAt(0).cloneRange();
    }


    restoreSelection() {

        const selection = window.getSelection();

        if (!selection) {
            return;
        }

        if (this.savedRange) {
            selection.removeAllRanges();
            selection.addRange(this.savedRange.cloneRange());
        }
    }


    isInsideEditor(node) {

        return !!(this.editorElement && node && this.editorElement.contains(node));
    }


    createEditorEndRange() {

        const range = document.createRange();
        range.selectNodeContents(this.editorElement);
        range.collapse(false);

        return range;
    }


    normalizeUrl(urlInput) {

        if (urlInput === null) {
            return null;
        }

        const url = urlInput.trim();

        if (!url) {
            return "";
        }

        if (/^(https?:|mailto:|tel:)/i.test(url)) {
            return url;
        }

        return `https://${url}`;
    }


    getActiveLinkElement() {

        const selection = window.getSelection();

        if (!selection || selection.rangeCount === 0) {
            return null;
        }

        const range = selection.getRangeAt(0);

        return this.findClosestLink(range.startContainer)
            || this.findClosestLink(range.endContainer)
            || this.findClosestLink(selection.anchorNode);
    }


    findClosestLink(node) {

        let current = node;

        while (current) {
            if (current.nodeType === Node.ELEMENT_NODE
                && current.tagName.toUpperCase() === "A") {
                return this.editorElement?.contains(current) ? current : null;
            }

            current = current.parentNode;
        }

        return null;
    }


    unwrapElement(element) {

        const parent = element?.parentNode;

        if (!parent) {
            return;
        }

        while (element.firstChild) {
            parent.insertBefore(element.firstChild, element);
        }

        element.remove();
    }


    clearFormatting() {

        document.execCommand("removeFormat");

        this.editorElement?.focus();

        this.updateOutputs();
    }


    updateOutputs() {

        if (!this.editorElement) {
            return;
        }

        if (this.htmlOutputElement) {
            this.htmlOutputElement.value =
                this.editorElement.innerHTML;
        }

        const model = this.buildDocumentModel();
        const json = JSON.stringify(model, null, 2);

        if (this.jsonOutputElement) {
            this.jsonOutputElement.value = json;
        }

        if (this.dotNetRef) {
            this.dotNetRef.invokeMethodAsync("HandleDocumentChanged", json);
        }
    }


    buildDocumentModel() {

        this.blockIdSequence = 0;

        return {
            schema: "we-content",
            version: 1,
            meta: {
                title: this.getDocumentTitle(),
                language: navigator.language || "en-US"
            },
            blocks: this.getBlocks()
        };
    }


    getDocumentTitle() {

        const titleNode =
            this.editorElement?.querySelector("h1");

        const title = titleNode?.textContent?.trim();

        return title || "Untitled";
    }


    getBlocks() {

        const blocks = [];

        this.editorElement?.childNodes.forEach(node => {
            blocks.push(...this.toBlocks(node));
        });

        return blocks;
    }


    toBlocks(node) {

        if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node;
            const children = Array.from(element.childNodes);

            const hasBlockChildren = children.some(child => this.isBlockElement(child));

            if (hasBlockChildren) {
                const blocks = [];

                children.forEach(child => {
                    blocks.push(...this.toBlocks(child));
                });

                return blocks;
            }
        }

        const block = this.toBlock(node);

        return block ? [block] : [];
    }


    toBlock(node) {

        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim();

            if (!text) {
                return null;
            }

            return {
                id: this.nextBlockId(),
                type: "paragraph",
                content: [{ text }]
            };
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return null;
        }

        const element = node;
        const tag = element.tagName.toUpperCase();

        if (tag === "H1" || tag === "H2" || tag === "H3") {
            return {
                id: this.nextBlockId(),
                type: "heading",
                level: Number.parseInt(tag.substring(1), 10),
                align: this.getAlignment(element),
                content: this.getRunsFromElement(element)
            };
        }

        if (tag === "P") {
            return {
                id: this.nextBlockId(),
                type: "paragraph",
                align: this.getAlignment(element),
                content: this.getRunsFromElement(element)
            };
        }

        if (tag === "BLOCKQUOTE") {
            return {
                id: this.nextBlockId(),
                type: "blockquote",
                align: this.getAlignment(element),
                content: this.getRunsFromElement(element)
            };
        }

        if (tag === "UL" || tag === "OL") {
            const items =
                Array.from(element.children)
                    .filter(child => child.tagName.toUpperCase() === "LI")
                    .map(li => this.getRunsFromElement(li));

            return {
                id: this.nextBlockId(),
                type: "list",
                ordered: tag === "OL",
                align: this.getAlignment(element),
                items
            };
        }

        if (tag === "TABLE") {
            const rows =
                Array.from(element.rows)
                    .map(row =>
                        Array.from(row.cells)
                            .map(cell => this.getRunsFromElement(cell)));

            return {
                id: this.nextBlockId(),
                type: "table",
                align: this.getAlignment(element),
                rows
            };
        }

        if (tag === "IMG") {
            return {
                id: this.nextBlockId(),
                type: "attachment",
                align: this.getAlignment(element),
                attachmentId: element.getAttribute("data-attachment-id") || null,
                src: element.getAttribute("src") || null,
                alt: element.getAttribute("alt") || ""
            };
        }

        return {
            id: this.nextBlockId(),
            type: "paragraph",
            align: this.getAlignment(element),
            content: this.getRunsFromElement(element)
        };
    }


    isBlockElement(node) {

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return false;
        }

        const tag = node.tagName.toUpperCase();

        return tag === "H1"
            || tag === "H2"
            || tag === "H3"
            || tag === "P"
            || tag === "BLOCKQUOTE"
            || tag === "UL"
            || tag === "OL"
            || tag === "TABLE"
            || tag === "IMG"
            || tag === "DIV";
    }


    getAlignment(element) {

        if (!element || !element.style) {
            return null;
        }

        const alignment = element.style.textAlign?.trim().toLowerCase();

        if (!alignment) {
            return null;
        }

        return alignment;
    }


    getRunsFromElement(element) {

        const runs = [];

        element.childNodes.forEach(node => {
            runs.push(...this.flattenInlineNode(node, []));
        });

        return runs;
    }


    flattenInlineNode(node, activeMarks) {

        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent;

            if (!text) {
                return [];
            }

            const run = { text };

            if (activeMarks.length > 0) {
                run.marks = [...activeMarks];
            }

            return [run];
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return [];
        }

        const element = node;
        const tag = element.tagName.toUpperCase();

        if (tag === "BR") {
            return [{ text: "\n" }];
        }

        const nextMarks = [...activeMarks];

        if (tag === "STRONG" || tag === "B") {
            nextMarks.push("bold");
        }

        if (tag === "EM" || tag === "I") {
            nextMarks.push("italic");
        }

        if (tag === "U") {
            nextMarks.push("underline");
        }

        if (tag === "A") {
            nextMarks.push({
                type: "link",
                href: element.getAttribute("href") || ""
            });
        }

        const runs = [];

        element.childNodes.forEach(child => {
            runs.push(...this.flattenInlineNode(child, nextMarks));
        });

        if (runs.length === 0) {
            return [{ text: "", marks: nextMarks }];
        }

        return runs;
    }


    nextBlockId() {

        this.blockIdSequence += 1;

        return `b${this.blockIdSequence}`;
    }
}


const editorInstances = new WeakMap();

window.webEditorInterop = {
    init(rootElement, dotNetRef, initialHtml) {
        if (!rootElement) {
            return;
        }

        const editor = new WysiwygEditor(rootElement, dotNetRef, initialHtml);
        editorInstances.set(rootElement, editor);
    },

    dispose(rootElement) {
        if (!rootElement) {
            return;
        }

        editorInstances.delete(rootElement);
    }
};
