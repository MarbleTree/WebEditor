class WysiwygEditor {

    constructor(rootElement, dotNetRef, initialHtml) {

        this.rootElement = rootElement;
        this.dotNetRef = dotNetRef;
        this.blockIdSequence = 0;
        this.savedRange = null;
        this.tableSizePicker = null;
        this.tableSizeLabel = null;
        this.tableInsertButton = null;
        this.activeResize = null;
        this.activeTableCell = null;
        this.cellMenuTrigger = null;
        this.cellMenuPanel = null;

        this.handleTablePickerDocumentMouseDown = event => {
            if (!this.tableSizePicker || this.tableSizePicker.hidden) {
                return;
            }

            const target = event.target;

            if (this.tableSizePicker.contains(target)
                || (this.tableInsertButton && this.tableInsertButton.contains(target))) {
                return;
            }

            this.hideTableSizePicker();
        };

        this.handleTablePickerDocumentKeyDown = event => {
            if (event.key !== "Escape") {
                return;
            }

            this.hideTableSizePicker();
            this.tableInsertButton?.focus();
        };

        this.handleResizeDocumentMouseMove = event => {
            if (!this.activeResize) {
                return;
            }

            this.applyActiveResize(event);
        };

        this.handleResizeDocumentMouseUp = () => {
            this.finishActiveResize();
        };

        this.handleCellMenuDocumentMouseDown = event => {
            if (!this.cellMenuPanel || this.cellMenuPanel.hidden) {
                return;
            }

            const target = event.target;

            if (this.cellMenuPanel.contains(target)
                || (this.cellMenuTrigger && this.cellMenuTrigger.contains(target))) {
                return;
            }

            this.hideCellContextMenu();
        };

        this.handleCellMenuDocumentKeyDown = event => {
            if (event.key !== "Escape") {
                return;
            }

            this.hideCellContextMenu();
            this.cellMenuTrigger?.focus();
        };

        this.handleCellMenuViewportChange = () => {
            this.positionCellMenuTrigger();
            this.positionCellContextMenu();
        };

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
        this.initializeCellContextMenu();

        this.updateOutputs();
    }


    dispose() {

        this.hideTableSizePicker();
        this.finishActiveResize();
        this.hideCellContextMenu();
        this.hideCellMenuTrigger();
    }


    initializeToolbar() {

        const toolbar = this.rootElement?.querySelector(".toolbar");

        if (!toolbar) {
            return;
        }

        this.initializeTableSizePicker(toolbar);

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

            const action = button.dataset.action;

            if (action !== "insert-table") {
                this.hideTableSizePicker();
            }

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
                    this.toggleTableSizePicker();
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


    initializeTableSizePicker(toolbar) {

        const insertButton = toolbar.querySelector("[data-action='insert-table']");

        if (!insertButton) {
            return;
        }

        this.tableInsertButton = insertButton;

        const picker = document.createElement("div");
        picker.className = "table-size-picker";
        picker.hidden = true;

        const grid = document.createElement("div");
        grid.className = "table-size-grid";

        for (let row = 1; row <= 8; row += 1) {
            for (let column = 1; column <= 8; column += 1) {
                const cellButton = document.createElement("button");
                cellButton.type = "button";
                cellButton.className = "table-size-cell";
                cellButton.dataset.rows = String(row);
                cellButton.dataset.columns = String(column);
                cellButton.setAttribute("aria-label", `Insert ${row} by ${column} table`);
                grid.appendChild(cellButton);
            }
        }

        const label = document.createElement("div");
        label.className = "table-size-label";
        label.textContent = "Select size";

        picker.appendChild(grid);
        picker.appendChild(label);
        toolbar.appendChild(picker);

        this.tableSizePicker = picker;
        this.tableSizeLabel = label;

        grid.addEventListener("mouseover", event => {
            const cell = event.target?.closest(".table-size-cell");

            if (!cell || !grid.contains(cell)) {
                return;
            }

            this.previewTableSize(
                Number.parseInt(cell.dataset.rows || "0", 10),
                Number.parseInt(cell.dataset.columns || "0", 10));
        });

        grid.addEventListener("focusin", event => {
            const cell = event.target?.closest(".table-size-cell");

            if (!cell || !grid.contains(cell)) {
                return;
            }

            this.previewTableSize(
                Number.parseInt(cell.dataset.rows || "0", 10),
                Number.parseInt(cell.dataset.columns || "0", 10));
        });

        grid.addEventListener("mouseleave", () => this.previewTableSize(0, 0));

        grid.addEventListener("click", event => {
            const cell = event.target?.closest(".table-size-cell");

            if (!cell || !grid.contains(cell)) {
                return;
            }

            event.preventDefault();

            const rows = Number.parseInt(cell.dataset.rows || "0", 10);
            const columns = Number.parseInt(cell.dataset.columns || "0", 10);

            this.hideTableSizePicker();
            this.insertTable(rows, columns);
        });
    }


    toggleTableSizePicker() {

        if (!this.tableSizePicker || !this.tableInsertButton) {
            return;
        }

        if (!this.tableSizePicker.hidden) {
            this.hideTableSizePicker();
            return;
        }

        this.rememberSelection();

        this.positionTableSizePicker();
        this.previewTableSize(0, 0);
        this.tableSizePicker.hidden = false;

        document.addEventListener("mousedown", this.handleTablePickerDocumentMouseDown, true);
        document.addEventListener("keydown", this.handleTablePickerDocumentKeyDown, true);
    }


    hideTableSizePicker() {

        if (!this.tableSizePicker || this.tableSizePicker.hidden) {
            return;
        }

        this.tableSizePicker.hidden = true;

        document.removeEventListener("mousedown", this.handleTablePickerDocumentMouseDown, true);
        document.removeEventListener("keydown", this.handleTablePickerDocumentKeyDown, true);
    }


    positionTableSizePicker() {

        if (!this.tableSizePicker || !this.tableInsertButton) {
            return;
        }
        const buttonRect = this.tableInsertButton.getBoundingClientRect();
        const pickerWidth = 201;
        const margin = 8;

        let left = buttonRect.left;
        let top = buttonRect.bottom + margin;

        if (left + pickerWidth > window.innerWidth - margin) {
            left = window.innerWidth - pickerWidth - margin;
        }

        if (left < margin) {
            left = margin;
        }

        if (top > window.innerHeight - 120) {
            top = Math.max(margin, buttonRect.top - 170);
        }

        this.tableSizePicker.style.left = `${Math.round(left)}px`;
        this.tableSizePicker.style.top = `${Math.round(top)}px`;
    }


    previewTableSize(rows, columns) {

        if (!this.tableSizePicker) {
            return;
        }

        const cells = this.tableSizePicker.querySelectorAll(".table-size-cell");

        cells.forEach(cell => {
            const cellRow = Number.parseInt(cell.dataset.rows || "0", 10);
            const cellColumn = Number.parseInt(cell.dataset.columns || "0", 10);
            const selected = rows > 0
                && columns > 0
                && cellRow <= rows
                && cellColumn <= columns;

            cell.classList.toggle("is-selected", selected);
        });

        if (!this.tableSizeLabel) {
            return;
        }

        this.tableSizeLabel.textContent = rows > 0 && columns > 0
            ? `${rows} × ${columns}`
            : "Select size";
    }


    initializeCellContextMenu() {

        if (!this.rootElement) {
            return;
        }

        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "cell-context-trigger";
        trigger.title = "Table options";
        trigger.setAttribute("aria-label", "Table options");
        trigger.textContent = "⋯";
        trigger.hidden = true;

        const menu = document.createElement("div");
        menu.className = "cell-context-menu";
        menu.hidden = true;

        const actions = [
            { action: "add-column-right", label: "Add column right" },
            { action: "add-row-below", label: "Add row below" },
            { action: "delete-column", label: "Delete column" },
            { action: "delete-row", label: "Delete row" }
        ];

        actions.forEach(item => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "cell-context-item";
            button.dataset.action = item.action;
            button.textContent = item.label;
            menu.appendChild(button);
        });

        this.rootElement.appendChild(trigger);
        this.rootElement.appendChild(menu);

        this.cellMenuTrigger = trigger;
        this.cellMenuPanel = menu;

        trigger.addEventListener("mousedown", event => {
            event.preventDefault();
            event.stopPropagation();
        });

        trigger.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();

            this.toggleCellContextMenu();
        });

        menu.addEventListener("mousedown", event => {
            event.preventDefault();
            event.stopPropagation();
        });

        menu.addEventListener("click", event => {
            const button = event.target?.closest("button");

            if (!button || !menu.contains(button)) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();

            this.executeCellMenuAction(button.dataset.action || "");
        });
    }


    executeCellMenuAction(action) {

        if (!this.activeTableCell) {
            this.hideCellContextMenu();
            return;
        }

        this.focusCell(this.activeTableCell);
        this.hideCellContextMenu();

        switch (action) {
            case "add-column-right":
                this.insertColumn();
                break;
            case "add-row-below":
                this.insertRow();
                break;
            case "delete-column":
                this.removeColumn();
                break;
            case "delete-row":
                this.removeRow();
                break;
            default:
                break;
        }

        this.positionCellMenuTrigger();
    }


    initializeEvents() {

        this.editorElement?.addEventListener("mousemove", event => this.handleEditorMouseMove(event));
        this.editorElement?.addEventListener("mouseleave", () => this.setEditorResizeCursor(null));
        this.editorElement?.addEventListener("mousedown", event => this.handleEditorMouseDown(event));

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


    handleEditorMouseMove(event) {

        if (!this.editorElement) {
            return;
        }

        if (this.activeResize) {
            this.setEditorResizeCursor(this.activeResize.type);
            return;
        }

        const resizeIntent = this.getResizeIntent(event);
        this.setEditorResizeCursor(resizeIntent?.type || null);
    }


    handleEditorMouseDown(event) {

        this.hideCellContextMenu();

        const resizeIntent = this.getResizeIntent(event);

        if (!resizeIntent) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        this.startResize(resizeIntent, event);
    }


    toggleCellContextMenu() {

        if (!this.cellMenuPanel || !this.cellMenuTrigger || !this.activeTableCell) {
            return;
        }

        if (!this.cellMenuPanel.hidden) {
            this.hideCellContextMenu();
            return;
        }

        this.positionCellContextMenu();
        this.cellMenuPanel.hidden = false;

        document.addEventListener("mousedown", this.handleCellMenuDocumentMouseDown, true);
        document.addEventListener("keydown", this.handleCellMenuDocumentKeyDown, true);
        window.addEventListener("resize", this.handleCellMenuViewportChange);
        window.addEventListener("scroll", this.handleCellMenuViewportChange, true);
    }


    hideCellContextMenu() {

        if (!this.cellMenuPanel || this.cellMenuPanel.hidden) {
            return;
        }

        this.cellMenuPanel.hidden = true;

        document.removeEventListener("mousedown", this.handleCellMenuDocumentMouseDown, true);
        document.removeEventListener("keydown", this.handleCellMenuDocumentKeyDown, true);
        window.removeEventListener("resize", this.handleCellMenuViewportChange);
        window.removeEventListener("scroll", this.handleCellMenuViewportChange, true);
    }


    hideCellMenuTrigger() {

        if (!this.cellMenuTrigger) {
            return;
        }

        this.cellMenuTrigger.hidden = true;
        this.hideCellContextMenu();
    }


    positionCellMenuTrigger() {

        if (!this.cellMenuTrigger || !this.activeTableCell || !this.editorElement) {
            this.hideCellMenuTrigger();
            return;
        }

        if (!this.editorElement.contains(this.activeTableCell)) {
            this.hideCellMenuTrigger();
            return;
        }

        const cellRect = this.activeTableCell.getBoundingClientRect();
        const triggerWidth = 16;
        const triggerHeight = 16;

        const left = Math.round(cellRect.right - triggerWidth - 2);
        const top = Math.round(cellRect.top + 2);

        this.cellMenuTrigger.style.left = `${left}px`;
        this.cellMenuTrigger.style.top = `${top}px`;
        this.cellMenuTrigger.hidden = false;
    }


    positionCellContextMenu() {

        if (!this.cellMenuPanel || !this.cellMenuTrigger) {
            return;
        }

        const triggerRect = this.cellMenuTrigger.getBoundingClientRect();
        const menuWidth = 210;
        const margin = 8;

        let left = triggerRect.right + 6;
        let top = triggerRect.top;

        if (left + menuWidth > window.innerWidth - margin) {
            left = triggerRect.left - menuWidth - 6;
        }

        if (left < margin) {
            left = margin;
        }

        if (top > window.innerHeight - 180) {
            top = Math.max(margin, window.innerHeight - 180);
        }

        this.cellMenuPanel.style.left = `${Math.round(left)}px`;
        this.cellMenuPanel.style.top = `${Math.round(top)}px`;
    }


    setActiveTableCell(cell) {

        if (!cell || !this.editorElement || !this.editorElement.contains(cell)) {
            this.activeTableCell = null;
            this.hideCellMenuTrigger();
            return;
        }

        this.activeTableCell = cell;
        this.positionCellMenuTrigger();

        if (!this.cellMenuPanel?.hidden) {
            this.positionCellContextMenu();
        }
    }


    getResizeIntent(event) {

        if (!this.editorElement) {
            return null;
        }

        const targetElement = event.target?.nodeType === Node.ELEMENT_NODE
            ? event.target
            : event.target?.parentElement;

        if (!targetElement || !this.editorElement.contains(targetElement)) {
            return null;
        }

        const table = targetElement.closest("table");

        if (!table || !this.editorElement.contains(table)) {
            return null;
        }

        const threshold = 8;
        const tableRect = table.getBoundingClientRect();
        const nearTableRight = Math.abs(event.clientX - tableRect.right) <= threshold;
        const withinTableY = event.clientY >= tableRect.top - threshold && event.clientY <= tableRect.bottom + threshold;

        if (nearTableRight && withinTableY) {
            return {
                type: "table-width",
                table,
                startX: event.clientX,
                startWidth: tableRect.width
            };
        }

        const cell = targetElement.closest("td,th");

        if (!cell || !table.contains(cell)) {
            return null;
        }

        const cellRect = cell.getBoundingClientRect();
        const nearCellRight = Math.abs(event.clientX - cellRect.right) <= threshold;
        const nearCellLeft = Math.abs(event.clientX - cellRect.left) <= threshold;
        const nearCellBottom = Math.abs(event.clientY - cellRect.bottom) <= threshold;
        const nearCellTop = Math.abs(event.clientY - cellRect.top) <= threshold;

        if (nearCellLeft && cell.cellIndex > 0) {
            const previousColumnIndex = cell.cellIndex - 1;
            const previousCell = cell.parentElement?.cells?.[previousColumnIndex] || cell;

            return {
                type: "column-width",
                table,
                columnIndex: previousColumnIndex,
                startX: event.clientX,
                startColumnWidth: previousCell.getBoundingClientRect().width,
                startTableWidth: tableRect.width
            };
        }

        if (nearCellRight) {
            return {
                type: "column-width",
                table,
                columnIndex: cell.cellIndex,
                startX: event.clientX,
                startColumnWidth: cellRect.width,
                startTableWidth: tableRect.width
            };
        }

        if (nearCellBottom) {
            return {
                type: "row-height",
                table,
                rowIndex: cell.parentElement?.rowIndex ?? 0,
                startY: event.clientY,
                startRowHeight: cell.parentElement?.getBoundingClientRect().height ?? cellRect.height
            };
        }

        const rowIndex = cell.parentElement?.rowIndex ?? 0;

        if (nearCellTop && rowIndex > 0) {
            const previousRow = table.rows[rowIndex - 1];

            return {
                type: "row-height",
                table,
                rowIndex: rowIndex - 1,
                startY: event.clientY,
                startRowHeight: previousRow?.getBoundingClientRect().height ?? cellRect.height
            };
        }

        return null;
    }


    setEditorResizeCursor(type) {

        if (!this.editorElement) {
            return;
        }

        this.editorElement.classList.remove("we-resize-col", "we-resize-row");

        if (type === "column-width" || type === "table-width") {
            this.editorElement.classList.add("we-resize-col");
            return;
        }

        if (type === "row-height") {
            this.editorElement.classList.add("we-resize-row");
        }
    }


    getCursorForResizeType(type) {

        switch (type) {
            case "column-width":
            case "table-width":
                return "ew-resize";
            case "row-height":
                return "ns-resize";
            default:
                return "";
        }
    }


    startResize(intent) {

        this.activeResize = intent;

        if (intent.type === "column-width" || intent.type === "table-width") {
            intent.table.style.width = `${Math.round(intent.startTableWidth ?? intent.startWidth)}px`;
        }

        if (intent.type === "column-width") {
            this.setColumnWidth(intent.table, intent.columnIndex, intent.startColumnWidth);
        }

        if (intent.type === "row-height") {
            this.setRowHeight(intent.table, intent.rowIndex, intent.startRowHeight);
        }

        document.addEventListener("mousemove", this.handleResizeDocumentMouseMove, true);
        document.addEventListener("mouseup", this.handleResizeDocumentMouseUp, true);
    }


    applyActiveResize(event) {

        if (!this.activeResize) {
            return;
        }

        const minColumnWidth = 48;
        const minTableWidth = 160;
        const minRowHeight = 28;

        switch (this.activeResize.type) {
            case "table-width": {
                const deltaX = event.clientX - this.activeResize.startX;
                const nextWidth = Math.max(minTableWidth, this.activeResize.startWidth + deltaX);
                this.activeResize.table.style.width = `${Math.round(nextWidth)}px`;
                break;
            }
            case "column-width": {
                const deltaX = event.clientX - this.activeResize.startX;
                const nextColumnWidth = Math.max(minColumnWidth, this.activeResize.startColumnWidth + deltaX);
                const nextTableWidth = Math.max(minTableWidth, this.activeResize.startTableWidth + deltaX);

                this.activeResize.table.style.width = `${Math.round(nextTableWidth)}px`;
                this.setColumnWidth(this.activeResize.table, this.activeResize.columnIndex, nextColumnWidth);
                break;
            }
            case "row-height": {
                const deltaY = event.clientY - this.activeResize.startY;
                const nextRowHeight = Math.max(minRowHeight, this.activeResize.startRowHeight + deltaY);
                this.setRowHeight(this.activeResize.table, this.activeResize.rowIndex, nextRowHeight);
                break;
            }
            default:
                break;
        }
    }


    finishActiveResize() {

        if (!this.activeResize) {
            return;
        }

        this.activeResize = null;

        document.removeEventListener("mousemove", this.handleResizeDocumentMouseMove, true);
        document.removeEventListener("mouseup", this.handleResizeDocumentMouseUp, true);

        if (this.editorElement) {
            this.setEditorResizeCursor(null);
            this.editorElement.focus();
        }

        this.updateOutputs();
    }


    setColumnWidth(table, columnIndex, width) {

        const roundedWidth = Math.max(1, Math.round(width));

        Array.from(table.rows).forEach(row => {
            if (columnIndex < row.cells.length) {
                const cell = row.cells[columnIndex];
                cell.style.width = `${roundedWidth}px`;
            }
        });
    }


    setRowHeight(table, rowIndex, height) {

        const row = table.rows[rowIndex];

        if (!row) {
            return;
        }

        const roundedHeight = Math.max(1, Math.round(height));

        Array.from(row.cells).forEach(cell => {
            cell.style.height = `${roundedHeight}px`;
        });
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


    insertTable(rows, columns) {

        if (!Number.isInteger(rows) || !Number.isInteger(columns)) {
            return;
        }

        if (rows < 1 || rows > 8 || columns < 1 || columns > 8) {
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
        if (!table.style.width) {
            table.style.width = "100%";
        }
        table.style.margin = "10px 0";
        table.style.cursor = "default";

        Array.from(table.rows).forEach(row => {
            Array.from(row.cells).forEach(cell => {
                cell.style.border = "1px solid #ccc";
                cell.style.padding = "6px";
                cell.style.minWidth = "72px";
                cell.style.minHeight = "28px";
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
            this.setActiveTableCell(null);
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
        this.setActiveTableCell(cell);

        this.editorElement?.focus();
    }


    rememberSelection() {

        const selection = window.getSelection();

        if (!selection || selection.rangeCount === 0) {
            this.setActiveTableCell(null);
            return;
        }

        if (!this.isInsideEditor(selection.anchorNode)) {
            this.setActiveTableCell(null);
            return;
        }

        this.savedRange = selection.getRangeAt(0).cloneRange();
        this.setActiveTableCell(this.getSelectedTableCell());
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

            const tableWidth = this.getPixelStyleValue(element.style.width);
            const columnWidths = this.getTableColumnWidths(element);
            const rowHeights = this.getTableRowHeights(element);

            return {
                id: this.nextBlockId(),
                type: "table",
                align: this.getAlignment(element),
                rows,
                tableWidth,
                columnWidths,
                rowHeights
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


    getPixelStyleValue(value) {

        if (!value || typeof value !== "string") {
            return null;
        }

        const normalized = value.trim().toLowerCase();

        if (!normalized.endsWith("px")) {
            return null;
        }

        const numeric = Number.parseFloat(normalized.slice(0, -2));

        if (!Number.isFinite(numeric) || numeric <= 0) {
            return null;
        }

        return Math.round(numeric);
    }


    getTableColumnWidths(table) {

        const firstRow = table?.rows?.[0];

        if (!firstRow || firstRow.cells.length === 0) {
            return null;
        }

        const widths = Array.from(firstRow.cells).map(cell => this.getPixelStyleValue(cell.style.width));

        return widths.some(width => width !== null)
            ? widths.map(width => width ?? 0)
            : null;
    }


    getTableRowHeights(table) {

        const heights = Array.from(table?.rows ?? []).map(row => {
            const firstCell = row.cells?.[0];
            return this.getPixelStyleValue(firstCell?.style.height || "");
        });

        return heights.some(height => height !== null)
            ? heights.map(height => height ?? 0)
            : null;
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

        const editor = editorInstances.get(rootElement);
        editor?.dispose();

        editorInstances.delete(rootElement);
    }
};
