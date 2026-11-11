class WysiwygEditor {

    constructor(rootElement, dotNetRef, initialHtml) {

        this.rootElement = rootElement;
        this.dotNetRef = dotNetRef;
        this.blockIdSequence = 0;

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

        this.rootElement
            .querySelectorAll("[data-command]")
            .forEach(button => {
                button.addEventListener("mousedown", event => {
                    event.preventDefault();

                    const command = button.dataset.command;
                    this.executeCommand(command);
                });
            });


        this.rootElement
            .querySelectorAll("[data-block]")
            .forEach(button => {
                button.addEventListener("mousedown", event => {
                    event.preventDefault();

                    const block = button.dataset.block;
                    this.formatBlock(block);
                });
            });


        this.rootElement
            .querySelector("[data-action='create-link']")
            ?.addEventListener("mousedown", event => {
                event.preventDefault();
                this.createLink();
            });


        this.rootElement
            .querySelector("[data-action='clear-formatting']")
            ?.addEventListener("mousedown", event => {
                event.preventDefault();
                this.clearFormatting();
            });
    }


    initializeEvents() {

        this.editorElement?.addEventListener(
            "input",
            () => this.updateOutputs()
        );
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

        const url = prompt("Enter the URL:");

        if (!url) {
            return;
        }

        document.execCommand("createLink", false, url);

        this.editorElement?.focus();

        this.updateOutputs();
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
