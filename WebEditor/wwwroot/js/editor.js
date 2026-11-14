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
        this.selectionAnchorCell = null;
        this.selectedTableCells = [];
        this.cellMenuTrigger = null;
        this.cellMenuPanel = null;
        this.activeImageElement = null;
        this.imageMenuTrigger = null;
        this.imageMenuPanel = null;
        this.hasShownDotNetSyncLimitWarning = false;
        this.inlineImageMaxBytes = this.getInlineImageMaxBytes();
        this.dotNetSyncMaxBytes = this.getDotNetSyncMaxBytes();

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
            this.positionVisibleCellSubmenus();
            this.positionImageMenuTrigger();
            this.positionImageContextMenu();
        };

        this.handleImageMenuDocumentMouseDown = event => {
            if (!this.imageMenuPanel || this.imageMenuPanel.hidden) {
                return;
            }

            const target = event.target;

            if (this.imageMenuPanel.contains(target)
                || (this.imageMenuTrigger && this.imageMenuTrigger.contains(target))) {
                return;
            }

            this.hideImageContextMenu();
        };

        this.handleImageMenuDocumentKeyDown = event => {
            if (event.key !== "Escape") {
                return;
            }

            this.hideImageContextMenu();
            this.imageMenuTrigger?.focus();
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
        this.initializeImageContextMenu();

        this.updateOutputs();
    }


    dispose() {

        this.hideTableSizePicker();
        this.finishActiveResize();
        this.hideCellContextMenu();
        this.hideCellMenuTrigger();
        this.hideImageContextMenu();
        this.hideImageMenuTrigger();
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
                case "insert-image":
                    this.insertImage();
                    break;
                case "image-display":
                    this.showImageContextMenu();
                    break;
                case "remove-image":
                    this.removeImage();
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


    moveFocusByTab(cell, reverse) {

        const table = cell.closest("table");

        if (!table) {
            return;
        }

        const orderedCells = this.getOrderedAnchorCells(table);
        const currentIndex = orderedCells.findIndex(item => item.cell === cell);

        if (currentIndex < 0) {
            return;
        }

        const targetIndex = reverse ? currentIndex - 1 : currentIndex + 1;

        if (targetIndex >= 0 && targetIndex < orderedCells.length) {
            this.focusCell(orderedCells[targetIndex].cell);
            this.selectionAnchorCell = orderedCells[targetIndex].cell;
            this.setSelectedTableCells([orderedCells[targetIndex].cell]);
            return;
        }

        if (reverse) {
            return;
        }

        this.insertRow();
    }


    getFormattingTargetCells() {

        if (!this.activeTableCell) {
            return [];
        }

        const table = this.activeTableCell.closest("table");

        if (!table) {
            return [];
        }

        const selected = this.selectedTableCells
            .filter(cell => table.contains(cell));

        return selected.length > 0 ? selected : [this.activeTableCell];
    }


    setSelectedTableCells(cells) {

        this.clearSelectedTableCells();

        const uniqueCells = [];

        cells.forEach(cell => {
            if (!cell || uniqueCells.includes(cell)) {
                return;
            }

            uniqueCells.push(cell);
            cell.classList.add("we-cell-selected");
        });

        this.selectedTableCells = uniqueCells;
    }


    clearSelectedTableCells() {

        this.selectedTableCells.forEach(cell => {
            cell.classList.remove("we-cell-selected");
        });

        this.selectedTableCells = [];
    }


    selectTableCellRange(startCell, endCell) {

        if (!startCell || !endCell) {
            return;
        }

        const table = startCell.closest("table");

        if (!table || table !== endCell.closest("table")) {
            return;
        }

        const startPosition = this.getCellAnchorPosition(table, startCell);
        const endPosition = this.getCellAnchorPosition(table, endCell);

        if (!startPosition || !endPosition) {
            return;
        }

        const minRow = Math.min(startPosition.row, endPosition.row);
        const maxRow = Math.max(startPosition.row, endPosition.row);
        const minColumn = Math.min(startPosition.column, endPosition.column);
        const maxColumn = Math.max(startPosition.column, endPosition.column);

        const selected = [];
        const seen = new Set();

        for (let row = minRow; row <= maxRow; row += 1) {
            for (let column = minColumn; column <= maxColumn; column += 1) {
                const cell = this.getCellAtLogicalPosition(table, row, column);

                if (!cell || seen.has(cell)) {
                    continue;
                }

                seen.add(cell);
                selected.push(cell);
            }
        }

        this.setSelectedTableCells(selected);
    }


    buildTableGrid(table) {

        const grid = [];

        Array.from(table?.rows ?? []).forEach((row, rowIndex) => {
            if (!grid[rowIndex]) {
                grid[rowIndex] = [];
            }

            let columnIndex = 0;

            Array.from(row.cells).forEach(cell => {
                while (grid[rowIndex][columnIndex]) {
                    columnIndex += 1;
                }

                const rowSpan = Math.max(1, cell.rowSpan || 1);
                const colSpan = Math.max(1, cell.colSpan || 1);

                for (let r = 0; r < rowSpan; r += 1) {
                    if (!grid[rowIndex + r]) {
                        grid[rowIndex + r] = [];
                    }

                    for (let c = 0; c < colSpan; c += 1) {
                        grid[rowIndex + r][columnIndex + c] = cell;
                    }
                }

                columnIndex += colSpan;
            });
        });

        return grid;
    }


    getCellAnchorPosition(table, targetCell) {

        const grid = this.buildTableGrid(table);

        for (let row = 0; row < grid.length; row += 1) {
            const columns = grid[row] || [];

            for (let column = 0; column < columns.length; column += 1) {
                const cell = columns[column];

                if (cell !== targetCell) {
                    continue;
                }

                const isTop = row === 0 || grid[row - 1]?.[column] !== targetCell;
                const isLeft = column === 0 || columns[column - 1] !== targetCell;

                if (isTop && isLeft) {
                    return { row, column };
                }
            }
        }

        return null;
    }


    getActiveImageElement() {

        const selection = window.getSelection();

        if (!selection || selection.rangeCount === 0) {
            return null;
        }

        const range = selection.getRangeAt(0);

        return this.findClosestImage(range.startContainer)
            || this.findClosestImage(range.endContainer)
            || this.findClosestImage(selection.anchorNode);
    }


    findClosestImage(node) {

        let current = node;

        while (current) {
            if (current.nodeType === Node.ELEMENT_NODE
                && current.tagName.toUpperCase() === "IMG") {
                return this.editorElement?.contains(current) ? current : null;
            }

            current = current.parentNode;
        }

        return null;
    }


    getCellAtLogicalPosition(table, rowIndex, columnIndex) {

        const grid = this.buildTableGrid(table);

        return grid[rowIndex]?.[columnIndex] || null;
    }


    getOrderedAnchorCells(table) {

        const grid = this.buildTableGrid(table);
        const ordered = [];
        const seen = new Set();

        for (let row = 0; row < grid.length; row += 1) {
            const columns = grid[row] || [];

            for (let column = 0; column < columns.length; column += 1) {
                const cell = columns[column];

                if (!cell || seen.has(cell)) {
                    continue;
                }

                const position = this.getCellAnchorPosition(table, cell);

                if (!position || position.row !== row || position.column !== column) {
                    continue;
                }

                seen.add(cell);
                ordered.push({ cell, row, column });
            }
        }

        return ordered;
    }


    toggleHeaderRow() {

        const cell = this.getSelectedTableCell();
        const table = cell?.closest("table");

        if (!table || table.rows.length === 0) {
            return;
        }

        const firstRow = table.rows[0];
        const hasHeader = Array.from(firstRow.cells).every(current => current.tagName.toUpperCase() === "TH");

        Array.from(firstRow.cells).forEach(current => {
            const replacement = document.createElement(hasHeader ? "td" : "th");

            Array.from(current.attributes).forEach(attribute => {
                replacement.setAttribute(attribute.name, attribute.value);
            });

            while (current.firstChild) {
                replacement.appendChild(current.firstChild);
            }

            current.replaceWith(replacement);
        });

        const headerCells = Array.from(table.rows[0]?.cells ?? []);
        const firstHeaderCell = headerCells[0] || null;

        this.setActiveTableCell(firstHeaderCell);
        this.selectionAnchorCell = firstHeaderCell;
        this.setSelectedTableCells(headerCells);

        if (firstHeaderCell) {
            this.focusCell(firstHeaderCell);
        }

        this.updateOutputs();
    }


    insertImage() {

        const imageUrlInput = prompt("Enter image URL. Leave empty to upload an image file:", "");

        if (imageUrlInput === null) {
            return;
        }

        const imageUrl = imageUrlInput.trim();

        if (imageUrl) {
            this.insertImageAtSelection(imageUrl, "image");
            return;
        }

        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.style.display = "none";

        fileInput.addEventListener("change", () => {
            const file = fileInput.files?.[0];

            if (!file) {
                fileInput.remove();
                return;
            }

            if (file.size > this.inlineImageMaxBytes) {
                const maxSizeText = this.formatBytes(this.inlineImageMaxBytes);
                const fileSizeText = this.formatBytes(file.size);
                const hostedUrlInput = prompt(
                    `\"${file.name}\" is ${fileSizeText}, which exceeds the inline JSON limit (${maxSizeText}). Enter hosted image URL:`,
                    ""
                );

                if (hostedUrlInput) {
                    const hostedUrl = hostedUrlInput.trim();

                    if (hostedUrl) {
                        this.insertImageAtSelection(hostedUrl, file.name);
                    }
                }

                fileInput.remove();
                return;
            }

            const reader = new FileReader();

            reader.onload = () => {
                const result = typeof reader.result === "string" ? reader.result : "";

                if (result) {
                    this.insertImageAtSelection(result, file.name);
                }

                fileInput.remove();
            };

            reader.onerror = () => {
                fileInput.remove();
            };

            reader.readAsDataURL(file);
        }, { once: true });

        document.body.appendChild(fileInput);
        fileInput.click();
    }


    insertImageAtSelection(src, altText) {

        if (!src || !this.editorElement) {
            return;
        }

        const image = document.createElement("img");
        image.src = src;
        image.alt = altText || "image";
        this.setImageDisplayOption(image, "medium");

        const paragraph = document.createElement("p");
        paragraph.appendChild(image);

        const trailingParagraph = document.createElement("p");
        trailingParagraph.appendChild(document.createElement("br"));

        const selection = window.getSelection();

        if (!selection) {
            return;
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
        fragment.appendChild(paragraph);
        fragment.appendChild(trailingParagraph);

        range.insertNode(fragment);

        this.focusNode(trailingParagraph);
        this.updateOutputs();
    }


    changeImageDisplay() {

        const image = this.getActiveImageElement();

        if (!image) {
            return;
        }

        const currentOption = (image.dataset.displayOption || "medium").trim();
        const option = prompt("Image display option (inline, small, medium, large, full):", currentOption);

        if (option === null) {
            return;
        }

        this.setImageDisplayOption(image, option.trim().toLowerCase());
        this.updateOutputs();
    }


    removeImage() {

        const image = this.getActiveImageElement() || this.activeImageElement;

        if (!image) {
            return;
        }

        const parent = image.parentElement;
        image.remove();

        if (parent && parent.tagName.toUpperCase() === "P" && !parent.textContent?.trim() && parent.querySelectorAll("img").length === 0) {
            parent.appendChild(document.createElement("br"));
        }

        this.setActiveImageElement(null);
        this.editorElement?.focus();
        this.updateOutputs();
    }


    setImageDisplayOption(image, option) {

        if (!image) {
            return;
        }

        const normalized = option || "medium";

        image.style.maxWidth = "100%";
        image.style.height = "auto";

        if (normalized === "inline") {
            image.style.display = "inline";
            image.style.width = "";
            image.style.marginLeft = "";
            image.style.marginRight = "";
            image.dataset.displayOption = "inline";
            return;
        }

        let width = "50%";
        let displayOption = "medium";

        if (normalized === "small") {
            width = "25%";
            displayOption = "small";
        } else if (normalized === "large") {
            width = "75%";
            displayOption = "large";
        } else if (normalized === "full") {
            width = "100%";
            displayOption = "full";
        }

        image.style.display = "block";
        image.style.width = width;
        image.style.marginLeft = "auto";
        image.style.marginRight = "auto";
        image.dataset.displayOption = displayOption;
    }


    mergeCellRight() {

        const cell = this.getSelectedTableCell();

        if (!cell) {
            return;
        }

        const table = cell.closest("table");

        if (!table) {
            return;
        }

        const position = this.getCellAnchorPosition(table, cell);

        if (!position) {
            return;
        }

        const rightCell = this.getCellAtLogicalPosition(table, position.row, position.column + cell.colSpan);

        if (!rightCell || rightCell === cell || rightCell.rowSpan !== cell.rowSpan) {
            return;
        }

        while (rightCell.firstChild) {
            if (cell.lastChild) {
                cell.appendChild(document.createTextNode(" "));
            }

            cell.appendChild(rightCell.firstChild);
        }

        cell.colSpan = Math.max(1, cell.colSpan + rightCell.colSpan);
        rightCell.remove();

        this.focusCell(cell);
        this.setSelectedTableCells([cell]);
        this.updateOutputs();
    }


    mergeCellDown() {

        const cell = this.getSelectedTableCell();

        if (!cell) {
            return;
        }

        const table = cell.closest("table");

        if (!table) {
            return;
        }

        const position = this.getCellAnchorPosition(table, cell);

        if (!position) {
            return;
        }

        const targetRow = position.row + cell.rowSpan;
        const belowCell = this.getCellAtLogicalPosition(table, targetRow, position.column);

        if (!belowCell || belowCell === cell || belowCell.colSpan !== cell.colSpan) {
            return;
        }

        while (belowCell.firstChild) {
            if (cell.lastChild) {
                cell.appendChild(document.createElement("br"));
            }

            cell.appendChild(belowCell.firstChild);
        }

        cell.rowSpan = Math.max(1, cell.rowSpan + belowCell.rowSpan);
        belowCell.remove();

        this.focusCell(cell);
        this.setSelectedTableCells([cell]);
        this.updateOutputs();
    }


    splitCell() {

        const cell = this.getSelectedTableCell();

        if (!cell) {
            return;
        }

        const table = cell.closest("table");

        if (!table) {
            return;
        }

        const position = this.getCellAnchorPosition(table, cell);

        if (!position) {
            return;
        }

        const originalRowSpan = Math.max(1, cell.rowSpan || 1);
        const originalColSpan = Math.max(1, cell.colSpan || 1);

        if (originalRowSpan === 1 && originalColSpan === 1) {
            return;
        }

        cell.rowSpan = 1;
        cell.colSpan = 1;

        for (let index = 1; index < originalColSpan; index += 1) {
            const newCell = this.createEmptyCell(cell.tagName.toUpperCase() === "TH" ? "th" : "td");
            cell.parentElement.insertBefore(newCell, cell.nextSibling);
        }

        for (let rowOffset = 1; rowOffset < originalRowSpan; rowOffset += 1) {
            const row = table.rows[position.row + rowOffset];

            if (!row) {
                continue;
            }

            const insertionIndex = this.findInsertionCellIndex(row, position.column);

            for (let colOffset = 0; colOffset < originalColSpan; colOffset += 1) {
                const newCell = this.createEmptyCell(cell.tagName.toUpperCase() === "TH" ? "th" : "td");
                row.insertBefore(newCell, row.cells[insertionIndex + colOffset] || null);
            }
        }

        this.applyTableVisualStyle(table);
        this.focusCell(cell);
        this.setSelectedTableCells([cell]);
        this.updateOutputs();
    }


    findInsertionCellIndex(row, logicalColumnIndex) {

        let logicalIndex = 0;

        for (let index = 0; index < row.cells.length; index += 1) {
            const current = row.cells[index];
            const span = Math.max(1, current.colSpan || 1);

            if (logicalIndex >= logicalColumnIndex) {
                return index;
            }

            logicalIndex += span;
        }

        return row.cells.length;
    }


    moveRow(direction) {

        const cell = this.getSelectedTableCell();
        const row = cell?.parentElement;

        if (!row) {
            return;
        }

        const parent = row.parentElement;
        const target = direction < 0 ? row.previousElementSibling : row.nextElementSibling;

        if (!parent || !target) {
            return;
        }

        if (direction < 0) {
            parent.insertBefore(row, target);
        } else {
            parent.insertBefore(target, row);
        }

        this.focusCell(row.cells[Math.min(cell.cellIndex, row.cells.length - 1)] || row.cells[0] || null);
        this.updateOutputs();
    }


    moveColumn(direction) {

        const cell = this.getSelectedTableCell();
        const table = cell?.closest("table");

        if (!cell || !table) {
            return;
        }

        const columnIndex = cell.cellIndex;
        const targetIndex = columnIndex + direction;

        if (targetIndex < 0) {
            return;
        }

        Array.from(table.rows).forEach(row => {
            if (columnIndex >= row.cells.length || targetIndex >= row.cells.length) {
                return;
            }

            const source = row.cells[columnIndex];
            const target = row.cells[targetIndex];

            if (direction < 0) {
                row.insertBefore(source, target);
            } else {
                row.insertBefore(target, source);
            }
        });

        this.focusCell(table.rows[cell.parentElement?.rowIndex ?? 0]?.cells?.[targetIndex] || null);
        this.updateOutputs();
    }


    deleteTable() {

        const cell = this.getSelectedTableCell();
        const table = cell?.closest("table");

        if (!table) {
            return;
        }

        const paragraph = document.createElement("p");
        paragraph.appendChild(document.createElement("br"));

        table.replaceWith(paragraph);

        this.setActiveTableCell(null);
        this.clearSelectedTableCells();
        this.selectionAnchorCell = null;

        this.focusNode(paragraph);
        this.updateOutputs();
    }


    focusNode(node) {

        const selection = window.getSelection();

        if (!selection || !node) {
            return;
        }

        const range = document.createRange();
        range.selectNodeContents(node);
        range.collapse(true);

        selection.removeAllRanges();
        selection.addRange(range);

        this.savedRange = range.cloneRange();
        this.editorElement?.focus();
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

        const backgroundButton = document.createElement("button");
        backgroundButton.type = "button";
        backgroundButton.className = "cell-context-item has-submenu";
        backgroundButton.dataset.action = "show-background-colors";
        backgroundButton.innerHTML = "<span>Background color</span><span class=\"submenu-chevron\">›</span>";
        menu.appendChild(backgroundButton);

        const backgroundPanel = document.createElement("div");
        backgroundPanel.className = "cell-context-submenu";
        backgroundPanel.dataset.group = "background";
        backgroundPanel.hidden = true;

        const clearColorButton = document.createElement("button");
        clearColorButton.type = "button";
        clearColorButton.className = "cell-context-color clear-color";
        clearColorButton.dataset.action = "set-background-color";
        clearColorButton.dataset.color = "";
        clearColorButton.textContent = "No color";
        backgroundPanel.appendChild(clearColorButton);

        const colors = [
            "#f8fafc", "#fee2e2", "#ffedd5", "#fef3c7", "#ecfccb", "#dcfce7", "#dbeafe", "#ede9fe", "#fce7f3", "#f3f4f6",
            "#e2e8f0", "#fecaca", "#fed7aa", "#fde68a", "#d9f99d", "#bbf7d0", "#bfdbfe", "#ddd6fe", "#fbcfe8", "#e5e7eb",
            "#cbd5e1", "#fca5a5", "#fdba74", "#fcd34d", "#bef264", "#86efac", "#93c5fd", "#c4b5fd", "#f9a8d4", "#d1d5db"
        ];

        colors.forEach(color => {
            const colorButton = document.createElement("button");
            colorButton.type = "button";
            colorButton.className = "cell-context-color";
            colorButton.dataset.action = "set-background-color";
            colorButton.dataset.color = color;
            colorButton.title = color;
            colorButton.style.backgroundColor = color;
            backgroundPanel.appendChild(colorButton);
        });

        menu.appendChild(backgroundPanel);

        const verticalAlignButton = document.createElement("button");
        verticalAlignButton.type = "button";
        verticalAlignButton.className = "cell-context-item has-submenu";
        verticalAlignButton.dataset.action = "show-vertical-align";
        verticalAlignButton.innerHTML = "<span>Vertical alignment</span><span class=\"submenu-chevron\">›</span>";
        menu.appendChild(verticalAlignButton);

        const verticalPanel = document.createElement("div");
        verticalPanel.className = "cell-context-submenu align-options";
        verticalPanel.dataset.group = "vertical";
        verticalPanel.hidden = true;

        [
            { value: "top", label: "Top" },
            { value: "middle", label: "Middle" },
            { value: "bottom", label: "Bottom" }
        ].forEach(item => {
            const alignButton = document.createElement("button");
            alignButton.type = "button";
            alignButton.className = "cell-context-align";
            alignButton.dataset.action = "set-vertical-align";
            alignButton.dataset.value = item.value;
            alignButton.textContent = item.label;
            verticalPanel.appendChild(alignButton);
        });

        menu.appendChild(verticalPanel);

        const stylePresetButton = document.createElement("button");
        stylePresetButton.type = "button";
        stylePresetButton.className = "cell-context-item has-submenu";
        stylePresetButton.dataset.action = "show-cell-style";
        stylePresetButton.innerHTML = "<span>Cell style</span><span class=\"submenu-chevron\">›</span>";
        menu.appendChild(stylePresetButton);

        const stylePresetPanel = document.createElement("div");
        stylePresetPanel.className = "cell-context-submenu align-options";
        stylePresetPanel.dataset.group = "cell-style";
        stylePresetPanel.hidden = true;

        [
            { value: "compact", label: "Compact" },
            { value: "normal", label: "Normal" },
            { value: "comfortable", label: "Comfortable" }
        ].forEach(item => {
            const presetButton = document.createElement("button");
            presetButton.type = "button";
            presetButton.className = "cell-context-align";
            presetButton.dataset.action = "set-cell-style";
            presetButton.dataset.value = item.value;
            presetButton.textContent = item.label;
            stylePresetPanel.appendChild(presetButton);
        });

        menu.appendChild(stylePresetPanel);

        const mergeButton = document.createElement("button");
        mergeButton.type = "button";
        mergeButton.className = "cell-context-item has-submenu";
        mergeButton.dataset.action = "show-merge-split";
        mergeButton.innerHTML = "<span>Merge / Split</span><span class=\"submenu-chevron\">›</span>";
        menu.appendChild(mergeButton);

        const mergePanel = document.createElement("div");
        mergePanel.className = "cell-context-submenu grouped-actions";
        mergePanel.dataset.group = "merge-split";
        mergePanel.hidden = true;

        [
            { action: "toggle-header-row", label: "Toggle header row" },
            { action: "merge-right", label: "Merge right" },
            { action: "merge-down", label: "Merge down" },
            { action: "split-cell", label: "Split cell" }
        ].forEach(item => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "cell-context-item";
            button.dataset.action = item.action;
            button.textContent = item.label;
            mergePanel.appendChild(button);
        });

        menu.appendChild(mergePanel);

        const addMoveButton = document.createElement("button");
        addMoveButton.type = "button";
        addMoveButton.className = "cell-context-item has-submenu";
        addMoveButton.dataset.action = "show-add-move";
        addMoveButton.innerHTML = "<span>Add / Move</span><span class=\"submenu-chevron\">›</span>";
        menu.appendChild(addMoveButton);

        const addMovePanel = document.createElement("div");
        addMovePanel.className = "cell-context-submenu grouped-actions";
        addMovePanel.dataset.group = "add-move";
        addMovePanel.hidden = true;

        [
            { action: "add-column-right", label: "Add column right" },
            { action: "add-row-below", label: "Add row below" },
            { action: "move-column-left", label: "Move column left" },
            { action: "move-column-right", label: "Move column right" },
            { action: "move-row-up", label: "Move row up" },
            { action: "move-row-down", label: "Move row down" }
        ].forEach(item => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "cell-context-item";
            button.dataset.action = item.action;
            button.textContent = item.label;
            addMovePanel.appendChild(button);
        });

        menu.appendChild(addMovePanel);

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "cell-context-item has-submenu";
        deleteButton.dataset.action = "show-delete-actions";
        deleteButton.innerHTML = "<span>Delete</span><span class=\"submenu-chevron\">›</span>";
        menu.appendChild(deleteButton);

        const deletePanel = document.createElement("div");
        deletePanel.className = "cell-context-submenu grouped-actions";
        deletePanel.dataset.group = "delete";
        deletePanel.hidden = true;

        [
            { action: "delete-column", label: "Delete column" },
            { action: "delete-row", label: "Delete row" },
            { action: "delete-table", label: "Delete table" }
        ].forEach(item => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "cell-context-item";
            button.dataset.action = item.action;
            button.textContent = item.label;
            deletePanel.appendChild(button);
        });

        menu.appendChild(deletePanel);

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

            this.executeCellMenuAction(button);
        });
    }


    initializeImageContextMenu() {

        if (!this.rootElement) {
            return;
        }

        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "image-context-trigger";
        trigger.title = "Image options";
        trigger.setAttribute("aria-label", "Image options");
        trigger.textContent = "⋯";
        trigger.hidden = true;

        const menu = document.createElement("div");
        menu.className = "image-context-menu";
        menu.hidden = true;

        [
            { action: "image-inline", label: "Display: Inline" },
            { action: "image-small", label: "Display: Small" },
            { action: "image-medium", label: "Display: Medium" },
            { action: "image-large", label: "Display: Large" },
            { action: "image-full", label: "Display: Full width" },
            { action: "image-align-left", label: "Align left" },
            { action: "image-align-center", label: "Align center" },
            { action: "image-align-right", label: "Align right" },
            { action: "image-remove", label: "Remove image" }
        ].forEach(item => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "image-context-item";
            button.dataset.action = item.action;
            button.textContent = item.label;
            menu.appendChild(button);
        });

        this.rootElement.appendChild(trigger);
        this.rootElement.appendChild(menu);

        this.imageMenuTrigger = trigger;
        this.imageMenuPanel = menu;

        trigger.addEventListener("mousedown", event => {
            event.preventDefault();
            event.stopPropagation();
        });

        trigger.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            this.toggleImageContextMenu();
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
            this.executeImageMenuAction(button.dataset.action || "");
        });
    }


    executeImageMenuAction(action) {

        if (!this.activeImageElement) {
            this.hideImageContextMenu();
            return;
        }

        switch (action) {
            case "image-inline":
                this.setImageDisplayOption(this.activeImageElement, "inline");
                break;
            case "image-small":
                this.setImageDisplayOption(this.activeImageElement, "small");
                break;
            case "image-medium":
                this.setImageDisplayOption(this.activeImageElement, "medium");
                break;
            case "image-large":
                this.setImageDisplayOption(this.activeImageElement, "large");
                break;
            case "image-full":
                this.setImageDisplayOption(this.activeImageElement, "full");
                break;
            case "image-align-left":
                this.activeImageElement.style.marginLeft = "0";
                this.activeImageElement.style.marginRight = "auto";
                break;
            case "image-align-center":
                this.activeImageElement.style.marginLeft = "auto";
                this.activeImageElement.style.marginRight = "auto";
                break;
            case "image-align-right":
                this.activeImageElement.style.marginLeft = "auto";
                this.activeImageElement.style.marginRight = "0";
                break;
            case "image-remove":
                this.removeImage();
                return;
            default:
                return;
        }

        this.hideImageContextMenu();
        this.updateOutputs();
    }


    showImageContextMenu() {

        const image = this.getActiveImageElement() || this.activeImageElement;

        if (!image) {
            return;
        }

        this.setActiveImageElement(image);
        this.hideCellContextMenu();
        this.positionImageContextMenu();
        this.imageMenuPanel.hidden = false;

        document.addEventListener("mousedown", this.handleImageMenuDocumentMouseDown, true);
        document.addEventListener("keydown", this.handleImageMenuDocumentKeyDown, true);
        window.addEventListener("resize", this.handleCellMenuViewportChange);
        window.addEventListener("scroll", this.handleCellMenuViewportChange, true);
    }


    toggleImageContextMenu() {

        if (!this.imageMenuPanel || !this.imageMenuTrigger || !this.activeImageElement) {
            return;
        }

        if (!this.imageMenuPanel.hidden) {
            this.hideImageContextMenu();
            return;
        }

        this.showImageContextMenu();
    }


    hideImageContextMenu() {

        if (!this.imageMenuPanel || this.imageMenuPanel.hidden) {
            return;
        }

        this.imageMenuPanel.hidden = true;
        document.removeEventListener("mousedown", this.handleImageMenuDocumentMouseDown, true);
        document.removeEventListener("keydown", this.handleImageMenuDocumentKeyDown, true);
        window.removeEventListener("resize", this.handleCellMenuViewportChange);
        window.removeEventListener("scroll", this.handleCellMenuViewportChange, true);
    }


    hideImageMenuTrigger() {

        if (!this.imageMenuTrigger) {
            return;
        }

        this.imageMenuTrigger.hidden = true;
        this.hideImageContextMenu();
    }


    positionImageMenuTrigger() {

        if (!this.imageMenuTrigger || !this.activeImageElement || !this.editorElement) {
            this.hideImageMenuTrigger();
            return;
        }

        if (!this.editorElement.contains(this.activeImageElement)) {
            this.hideImageMenuTrigger();
            return;
        }

        const imageRect = this.activeImageElement.getBoundingClientRect();
        const triggerWidth = 18;

        const left = Math.round(imageRect.right - triggerWidth - 2);
        const top = Math.round(imageRect.top + 2);

        this.imageMenuTrigger.style.left = `${left}px`;
        this.imageMenuTrigger.style.top = `${top}px`;
        this.imageMenuTrigger.hidden = false;
    }


    positionImageContextMenu() {

        if (!this.imageMenuPanel || !this.imageMenuTrigger) {
            return;
        }

        const triggerRect = this.imageMenuTrigger.getBoundingClientRect();
        const menuWidth = 220;
        const margin = 8;

        let left = triggerRect.right + 6;
        let top = triggerRect.top;

        if (left + menuWidth > window.innerWidth - margin) {
            left = triggerRect.left - menuWidth - 6;
        }

        if (left < margin) {
            left = margin;
        }

        if (top > window.innerHeight - 220) {
            top = Math.max(margin, window.innerHeight - 220);
        }

        this.imageMenuPanel.style.left = `${Math.round(left)}px`;
        this.imageMenuPanel.style.top = `${Math.round(top)}px`;
    }


    setActiveImageElement(image) {

        if (this.activeImageElement === image) {
            this.positionImageMenuTrigger();

            if (!this.imageMenuPanel?.hidden) {
                this.positionImageContextMenu();
            }

            return;
        }

        if (this.activeImageElement) {
            this.activeImageElement.classList.remove("is-active-image");
        }

        if (!image || !this.editorElement || !this.editorElement.contains(image)) {
            this.activeImageElement = null;
            this.hideImageMenuTrigger();
            return;
        }

        this.activeImageElement = image;
        this.activeImageElement.classList.add("is-active-image");

        this.positionImageMenuTrigger();

        if (!this.imageMenuPanel?.hidden) {
            this.positionImageContextMenu();
        }
    }


    executeCellMenuAction(button) {

        const action = button?.dataset?.action || "";

        if (action === "show-background-colors") {
            this.toggleCellSubmenu("background", button);
            return;
        }

        if (action === "show-vertical-align") {
            this.toggleCellSubmenu("vertical", button);
            return;
        }

        if (action === "show-cell-style") {
            this.toggleCellSubmenu("cell-style", button);
            return;
        }

        if (action === "show-merge-split") {
            this.toggleCellSubmenu("merge-split", button);
            return;
        }

        if (action === "show-add-move") {
            this.toggleCellSubmenu("add-move", button);
            return;
        }

        if (action === "show-delete-actions") {
            this.toggleCellSubmenu("delete", button);
            return;
        }

        if (!this.activeTableCell) {
            this.hideCellContextMenu();
            return;
        }

        this.focusCell(this.activeTableCell);
        this.hideCellContextMenu();

        switch (action) {
            case "set-background-color":
                this.applyCellBackgroundColor(button.dataset.color || "");
                break;
            case "set-vertical-align":
                this.applyCellVerticalAlign(button.dataset.value || "top");
                break;
            case "set-cell-style":
                this.applyCellStylePreset(button.dataset.value || "normal");
                break;
            case "toggle-header-row":
                this.toggleHeaderRow();
                break;
            case "merge-right":
                this.mergeCellRight();
                break;
            case "merge-down":
                this.mergeCellDown();
                break;
            case "split-cell":
                this.splitCell();
                break;
            case "add-column-right":
                this.insertColumn();
                break;
            case "add-row-below":
                this.insertRow();
                break;
            case "move-column-left":
                this.moveColumn(-1);
                break;
            case "move-column-right":
                this.moveColumn(1);
                break;
            case "move-row-up":
                this.moveRow(-1);
                break;
            case "move-row-down":
                this.moveRow(1);
                break;
            case "delete-column":
                this.removeColumn();
                break;
            case "delete-row":
                this.removeRow();
                break;
            case "delete-table":
                this.deleteTable();
                break;
            default:
                break;
        }

        this.positionCellMenuTrigger();
    }


    toggleCellSubmenu(group, anchorButton) {

        if (!this.cellMenuPanel) {
            return;
        }

        const panel = this.cellMenuPanel.querySelector(`.cell-context-submenu[data-group='${group}']`);

        if (!panel) {
            return;
        }

        const shouldShow = panel.hidden;

        this.hideAllCellSubmenus();

        panel.hidden = !shouldShow;

        if (shouldShow) {
            this.positionCellSubmenu(panel, anchorButton);
            this.syncCellSubmenuSelection(group);
        }
    }


    hideAllCellSubmenus() {

        if (!this.cellMenuPanel) {
            return;
        }

        this.cellMenuPanel.querySelectorAll(".cell-context-submenu").forEach(panel => {
            panel.hidden = true;
            panel.removeAttribute("data-anchor-action");
        });
    }


    positionCellSubmenu(panel, anchorButton) {

        if (!panel || !anchorButton) {
            return;
        }

        const anchorRect = anchorButton.getBoundingClientRect();
        const margin = 8;

        panel.hidden = false;

        const panelWidth = Math.max(220, panel.offsetWidth);
        const panelHeight = panel.offsetHeight;

        let left = anchorRect.right + 8;
        let top = anchorRect.top;

        if (left + panelWidth > window.innerWidth - margin) {
            left = anchorRect.left - panelWidth - 8;
        }

        if (left < margin) {
            left = margin;
        }

        if (top + panelHeight > window.innerHeight - margin) {
            top = Math.max(margin, window.innerHeight - panelHeight - margin);
        }

        panel.style.left = `${Math.round(left)}px`;
        panel.style.top = `${Math.round(top)}px`;
        panel.dataset.anchorAction = anchorButton.dataset.action || "";
    }


    syncCellSubmenuSelection(group) {

        if (!this.cellMenuPanel || !this.activeTableCell) {
            return;
        }

        const panel = this.cellMenuPanel.querySelector(`.cell-context-submenu[data-group='${group}']`);

        if (!panel) {
            return;
        }

        if (group === "vertical") {
            const currentAlign = (this.activeTableCell.style.verticalAlign || "top").trim().toLowerCase();

            panel.querySelectorAll(".cell-context-align").forEach(button => {
                button.classList.toggle("is-selected", button.dataset.value === currentAlign);
            });
        }

        if (group === "background") {
            const currentColor = (this.activeTableCell.style.backgroundColor || "").trim().toLowerCase();

            panel.querySelectorAll(".cell-context-color").forEach(button => {
                const buttonColor = (button.dataset.color || "").trim().toLowerCase();
                const selected = currentColor
                    ? buttonColor && currentColor === buttonColor
                    : buttonColor === "";
                button.classList.toggle("is-selected", selected);
            });
        }

        if (group === "cell-style") {
            const table = this.activeTableCell.closest("table");
            const style = this.detectCellStylePreset(table);

            panel.querySelectorAll(".cell-context-align").forEach(button => {
                button.classList.toggle("is-selected", button.dataset.value === style);
            });
        }
    }


    applyCellBackgroundColor(color) {

        const cells = this.getFormattingTargetCells();

        if (cells.length === 0) {
            return;
        }

        const normalized = (color || "").trim();

        cells.forEach(cell => {
            if (!normalized) {
                cell.style.backgroundColor = "";
            } else {
                cell.style.backgroundColor = normalized;
            }
        });

        this.updateOutputs();
    }


    applyCellVerticalAlign(value) {

        const cells = this.getFormattingTargetCells();

        if (cells.length === 0) {
            return;
        }

        const normalized = (value || "top").trim().toLowerCase();

        cells.forEach(cell => {
            if (normalized === "middle" || normalized === "bottom") {
                cell.style.verticalAlign = normalized;
            } else {
                cell.style.verticalAlign = "";
            }
        });

        this.updateOutputs();
    }


    applyCellStylePreset(value) {

        if (!this.activeTableCell) {
            return;
        }

        const table = this.activeTableCell.closest("table");

        if (!table) {
            return;
        }

        let padding = "6px";
        let border = "1px solid #ccc";

        if (value === "compact") {
            padding = "3px";
            border = "1px solid #d1d5db";
        }

        if (value === "comfortable") {
            padding = "10px";
            border = "1px solid #b9c2cf";
        }

        Array.from(table.rows).forEach(row => {
            Array.from(row.cells).forEach(cell => {
                cell.style.padding = padding;
                cell.style.border = border;
            });
        });

        this.updateOutputs();
    }


    detectCellStylePreset(table) {

        const firstCell = table?.rows?.[0]?.cells?.[0];

        if (!firstCell) {
            return "normal";
        }

        const padding = firstCell.style.padding?.trim();

        if (padding === "3px") {
            return "compact";
        }

        if (padding === "10px") {
            return "comfortable";
        }

        return "normal";
    }


    initializeEvents() {

        this.editorElement?.addEventListener("mousemove", event => this.handleEditorMouseMove(event));
        this.editorElement?.addEventListener("mouseleave", () => this.setEditorResizeCursor(null));
        this.editorElement?.addEventListener("mousedown", event => this.handleEditorMouseDown(event));
        this.editorElement?.addEventListener("click", event => this.handleEditorClick(event));
        this.editorElement?.addEventListener("keydown", event => this.handleEditorKeyDown(event));
        this.editorElement?.addEventListener("paste", event => this.handleEditorPaste(event));

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


    handleEditorPaste(event) {

        if (!event.clipboardData) {
            return;
        }

        const html = event.clipboardData.getData("text/html");

        if (!html) {
            return;
        }

        event.preventDefault();
        this.restoreSelection();

        if (document.queryCommandSupported && document.queryCommandSupported("insertHTML")) {
            document.execCommand("insertHTML", false, html);
        } else {
            const plainText = event.clipboardData.getData("text/plain");
            document.execCommand("insertText", false, plainText || "");
        }

        this.updateOutputs();
    }


    handleEditorClick(event) {

        const image = event.target?.closest("img");

        if (image && this.editorElement?.contains(image)) {
            this.setActiveImageElement(image);
            this.setActiveTableCell(null);
            this.clearSelectedTableCells();
            this.selectionAnchorCell = null;
            return;
        }

        this.setActiveImageElement(null);

        const cell = event.target?.closest("td,th");

        if (!cell || !this.editorElement?.contains(cell)) {
            this.clearSelectedTableCells();
            this.selectionAnchorCell = null;
            return;
        }

        this.setActiveTableCell(cell);

        if (event.shiftKey && this.selectionAnchorCell && this.selectionAnchorCell.closest("table") === cell.closest("table")) {
            this.selectTableCellRange(this.selectionAnchorCell, cell);
            return;
        }

        this.selectionAnchorCell = cell;
        this.setSelectedTableCells([cell]);
    }


    handleEditorKeyDown(event) {

        const cell = this.getSelectedTableCell();

        if (!cell) {
            return;
        }

        if (event.key === "Tab") {
            event.preventDefault();
            this.moveFocusByTab(cell, event.shiftKey);
            return;
        }

        if (!event.ctrlKey || !event.altKey) {
            return;
        }

        switch (event.key) {
            case "ArrowRight":
                event.preventDefault();
                this.insertColumn();
                break;
            case "ArrowDown":
                event.preventDefault();
                this.insertRow();
                break;
            case "Backspace":
                event.preventDefault();
                this.removeColumn();
                break;
            case "Delete":
                event.preventDefault();
                this.removeRow();
                break;
            default:
                break;
        }
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
        this.hideImageContextMenu();

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

        this.hideAllCellSubmenus();

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

        this.hideAllCellSubmenus();

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
        const triggerWidth = 18;
        const triggerHeight = 18;

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
        const menuWidth = 260;
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
            this.selectionAnchorCell = null;
            this.clearSelectedTableCells();
            this.hideCellMenuTrigger();
            return;
        }

        this.activeTableCell = cell;
        if (cell) {
            this.setActiveImageElement(null);
        }
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
            const templateCell = row.cells[i] || row.cells[row.cells.length - 1] || row.cells[0] || cell;
            const newCell = this.createEmptyCell(templateCell?.tagName || "td");
            this.cloneCellVisualStyle(templateCell, newCell);
            newRow.appendChild(newCell);
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
            const templateCell = row.cells[columnIndex] || row.cells[Math.max(0, columnIndex - 1)] || row.cells[0] || cell;
            const newCell = this.createEmptyCell(templateCell?.tagName || "td");
            this.cloneCellVisualStyle(templateCell, newCell);
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


    createEmptyCell(tagName = "td") {

        const cell = document.createElement(tagName.toLowerCase() === "th" ? "th" : "td");
        cell.appendChild(document.createElement("br"));

        return cell;
    }


    cloneCellVisualStyle(sourceCell, targetCell) {

        if (!sourceCell || !targetCell) {
            return;
        }

        targetCell.style.border = sourceCell.style.border;
        targetCell.style.padding = sourceCell.style.padding;
        targetCell.style.verticalAlign = sourceCell.style.verticalAlign;
        targetCell.style.backgroundColor = sourceCell.style.backgroundColor;
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
                if (!cell.style.border) {
                    cell.style.border = "1px solid #ccc";
                }

                if (!cell.style.padding) {
                    cell.style.padding = "6px";
                }

                cell.style.minWidth = "72px";
                cell.style.minHeight = "28px";

                if (!cell.style.verticalAlign) {
                    cell.style.verticalAlign = "top";
                }
            });
        });
    }


    getSelectedTableCell() {

        const selection = window.getSelection();

        if (!selection || selection.rangeCount === 0) {
            return this.activeTableCell;
        }

        const range = selection.getRangeAt(0);

        return this.findClosestTableCell(range.startContainer)
            || this.findClosestTableCell(range.endContainer)
            || this.findClosestTableCell(selection.anchorNode)
            || this.activeTableCell;
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
            this.setActiveImageElement(null);
            this.clearSelectedTableCells();
            return;
        }

        if (!this.isInsideEditor(selection.anchorNode)) {
            this.setActiveTableCell(null);
            this.setActiveImageElement(null);
            this.clearSelectedTableCells();
            return;
        }

        this.savedRange = selection.getRangeAt(0).cloneRange();
        const currentCell = this.getSelectedTableCell();
        const currentImage = this.getActiveImageElement();

        if (currentImage) {
            this.setActiveImageElement(currentImage);
            this.setActiveTableCell(null);
            this.clearSelectedTableCells();
            this.selectionAnchorCell = null;
            return;
        }

        this.setActiveImageElement(null);
        this.setActiveTableCell(currentCell);

        if (currentCell && !selection.isCollapsed) {
            this.selectionAnchorCell = currentCell;
            this.setSelectedTableCells([currentCell]);
        }
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


    getInlineImageMaxBytes() {

        const configured = this.rootElement?.getAttribute("data-inline-image-max-bytes") || "";
        const parsed = Number.parseInt(configured.trim(), 10);

        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }

        return 100 * 1024;
    }


    getDotNetSyncMaxBytes() {

        const configured = this.rootElement?.getAttribute("data-dotnet-sync-max-bytes") || "";
        const parsed = Number.parseInt(configured.trim(), 10);

        if (Number.isFinite(parsed) && parsed > 0) {
            return parsed;
        }

        return 256 * 1024;
    }


    getUtf8Length(value) {

        if (!value) {
            return 0;
        }

        if (typeof TextEncoder !== "undefined") {
            return new TextEncoder().encode(value).length;
        }

        return unescape(encodeURIComponent(value)).length;
    }


    reportDotNetSyncLimitExceeded(actualBytes, maxBytes) {

        if (this.hasShownDotNetSyncLimitWarning) {
            return;
        }

        this.hasShownDotNetSyncLimitWarning = true;

        const message = `Document JSON is ${this.formatBytes(actualBytes)}, which exceeds the sync limit (${this.formatBytes(maxBytes)}). Use hosted image URLs or reduce inline image size.`;

        console.error(message);
        window.alert(message);
    }


    handleDotNetSyncError(error, actualBytes, maxBytes) {

        const details = error?.message || "Unknown interop error";
        const message = `Document JSON sync failed (${this.formatBytes(actualBytes)}; limit ${this.formatBytes(maxBytes)}). Use hosted image URLs or reduce inline image size. Details: ${details}`;

        console.error(message, error);

        if (!this.hasShownDotNetSyncLimitWarning) {
            this.hasShownDotNetSyncLimitWarning = true;
            window.alert(message);
        }
    }


    formatBytes(bytes) {

        if (!Number.isFinite(bytes) || bytes <= 0) {
            return "0 B";
        }

        if (bytes < 1024) {
            return `${bytes} B`;
        }

        if (bytes < 1024 * 1024) {
            return `${(bytes / 1024).toFixed(0)} KB`;
        }

        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
            const jsonBytes = this.getUtf8Length(json);

            if (jsonBytes > this.dotNetSyncMaxBytes) {
                this.reportDotNetSyncLimitExceeded(jsonBytes, this.dotNetSyncMaxBytes);
                return;
            }

            this.hasShownDotNetSyncLimitWarning = false;
            this.dotNetRef.invokeMethodAsync("HandleDocumentChanged", json)
                .catch(error => {
                    this.handleDotNetSyncError(error, jsonBytes, this.dotNetSyncMaxBytes);
                });
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

            if (element.tagName.toUpperCase() === "P") {
                const imageBlocks = this.getImageBlocksFromParagraph(element);

                if (imageBlocks.length > 0) {
                    return imageBlocks;
                }
            }

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
            const cellStyles = this.getTableCellStyles(element);
            const cellMeta = this.getTableCellMeta(element);
            const cellPadding = this.getTableCellPadding(element);
            const cellBorderWidth = this.getTableCellBorderWidth(element);
            const cellBorderColor = this.getTableCellBorderColor(element);

            return {
                id: this.nextBlockId(),
                type: "table",
                align: this.getAlignment(element),
                rows,
                tableWidth,
                columnWidths,
                rowHeights,
                cellStyles,
                cellMeta,
                cellPadding,
                cellBorderWidth,
                cellBorderColor
            };
        }

        if (tag === "IMG") {
            const widthPercent = this.getPercentStyleValue(element.style.width);
            const imageDisplay = (element.dataset.displayOption || "").trim().toLowerCase() || null;
            const imageAlign = this.getImageAlignment(element);

            return {
                id: this.nextBlockId(),
                type: "attachment",
                align: imageAlign,
                attachmentId: element.getAttribute("data-attachment-id") || null,
                src: element.getAttribute("src") || null,
                alt: element.getAttribute("alt") || "",
                imageWidthPercent: widthPercent,
                imageDisplay
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


    getImageBlocksFromParagraph(paragraph) {

        if (!paragraph || paragraph.tagName.toUpperCase() !== "P") {
            return [];
        }

        const hasTextContent = (paragraph.textContent || "").trim().length > 0;

        if (hasTextContent) {
            return [];
        }

        const images = Array.from(paragraph.querySelectorAll("img"));

        if (images.length === 0) {
            return [];
        }

        const blocks = [];

        images.forEach(image => {
            const block = this.toBlock(image);

            if (block) {
                blocks.push(block);
            }
        });

        return blocks;
    }


    getImageAlignment(image) {

        if (!image) {
            return null;
        }

        const marginLeft = (image.style.marginLeft || "").trim().toLowerCase();
        const marginRight = (image.style.marginRight || "").trim().toLowerCase();

        if ((marginLeft === "0" || marginLeft === "0px") && marginRight === "auto") {
            return "left";
        }

        if (marginLeft === "auto" && (marginRight === "0" || marginRight === "0px")) {
            return "right";
        }

        if (marginLeft === "auto" && marginRight === "auto") {
            return "center";
        }

        return this.getAlignment(image);
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


    getPercentStyleValue(value) {

        if (!value || typeof value !== "string") {
            return null;
        }

        const normalized = value.trim().toLowerCase();

        if (!normalized.endsWith("%")) {
            return null;
        }

        const numeric = Number.parseFloat(normalized.slice(0, -1));

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


    getTableCellStyles(table) {

        const styles = Array.from(table?.rows ?? []).map(row =>
            Array.from(row.cells).map(cell => {
                const backgroundColor = (cell.style.backgroundColor || "").trim();
                const verticalAlign = (cell.style.verticalAlign || "").trim().toLowerCase();
                const style = {};

                if (backgroundColor) {
                    style.backgroundColor = backgroundColor;
                }

                if (verticalAlign && (verticalAlign === "middle" || verticalAlign === "bottom")) {
                    style.verticalAlign = verticalAlign;
                }

                return Object.keys(style).length > 0 ? style : null;
            }));

        return styles.some(row => row.some(cell => cell !== null))
            ? styles
            : null;
    }


    getTableCellMeta(table) {

        const meta = Array.from(table?.rows ?? []).map(row =>
            Array.from(row.cells).map(cell => {
                const colSpan = Math.max(1, cell.colSpan || 1);
                const rowSpan = Math.max(1, cell.rowSpan || 1);
                const isHeader = cell.tagName.toUpperCase() === "TH";
                const entry = {};

                if (colSpan > 1) {
                    entry.colSpan = colSpan;
                }

                if (rowSpan > 1) {
                    entry.rowSpan = rowSpan;
                }

                if (isHeader) {
                    entry.isHeader = true;
                }

                return Object.keys(entry).length > 0 ? entry : null;
            }));

        return meta.some(row => row.some(cell => cell !== null))
            ? meta
            : null;
    }


    getTableCellPadding(table) {

        const firstCell = table?.rows?.[0]?.cells?.[0];

        if (!firstCell) {
            return null;
        }

        return this.getPixelStyleValue(firstCell.style.padding);
    }


    getTableCellBorderWidth(table) {

        const firstCell = table?.rows?.[0]?.cells?.[0];

        if (!firstCell) {
            return null;
        }

        return this.getPixelStyleValue(firstCell.style.borderWidth);
    }


    getTableCellBorderColor(table) {

        const firstCell = table?.rows?.[0]?.cells?.[0];
        const color = firstCell?.style?.borderColor?.trim();

        return color || null;
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
            this.addStringMark(nextMarks, "bold");
        }

        if (tag === "EM" || tag === "I") {
            this.addStringMark(nextMarks, "italic");
        }

        if (tag === "U" || tag === "INS") {
            this.addStringMark(nextMarks, "underline");
        }

        const fontWeight = element.style?.fontWeight?.trim().toLowerCase();
        const numericWeight = Number.parseInt(fontWeight || "", 10);

        if (fontWeight === "bold" || Number.isFinite(numericWeight) && numericWeight >= 600) {
            this.addStringMark(nextMarks, "bold");
        }

        const fontStyle = element.style?.fontStyle?.trim().toLowerCase();

        if (fontStyle === "italic" || fontStyle === "oblique") {
            this.addStringMark(nextMarks, "italic");
        }

        const textDecoration = `${element.style?.textDecoration || ""} ${element.style?.textDecorationLine || ""}`
            .trim()
            .toLowerCase();

        if (textDecoration.includes("underline")) {
            this.addStringMark(nextMarks, "underline");
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


    addStringMark(marks, mark) {

        if (!marks || !mark) {
            return;
        }

        if (marks.some(item => typeof item === "string" && item === mark)) {
            return;
        }

        marks.push(mark);
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
