# WebEditor Document JSON Specification (Current)

This document describes the **current** JSON format produced by `wwwroot/js/editor.js` (`buildDocumentModel`) and consumed by the Blazor app.

## 1. Top-level structure

```json
{
  "schema": "we-content",
  "version": 1,
  "meta": {
	"title": "Article title",
	"language": "en-US"
  },
  "blocks": []
}
```

### Fields

- `schema` (`string`): currently always `"we-content"`.
- `version` (`number`): currently always `1`.
- `meta` (`object`)
  - `title` (`string`): taken from first `<h1>` text in editor, fallback `"Untitled"`.
  - `language` (`string`): browser `navigator.language`, fallback `"en-US"`.
- `blocks` (`array`): ordered content blocks.

## 2. Block model

Each block has:

- `id` (`string`): generated as `b1`, `b2`, ...
- `type` (`string`): one of `heading`, `paragraph`, `blockquote`, `list`, `table`, `attachment`
- `align` (`string|null`, optional): text alignment when present. Supported values: `left`, `center`, `right`, `justify`.

Additional fields depend on block `type`.

### 2.1 Heading block

```json
{
  "id": "b1",
  "type": "heading",
  "level": 1,
  "content": [ /* runs */ ]
}
```

- `level` (`number`): produced from HTML tag (`H1`/`H2`/`H3` currently).
- `content` (`array<run>`)

### 2.2 Paragraph block

```json
{
  "id": "b2",
  "type": "paragraph",
  "align": "center",
  "content": [ /* runs */ ]
}
```

- `content` (`array<run>`)

### 2.3 Blockquote block

```json
{
  "id": "b3",
  "type": "blockquote",
  "content": [ /* runs */ ]
}
```

- `content` (`array<run>`)

### 2.4 List block

```json
{
  "id": "b4",
  "type": "list",
  "ordered": false,
  "items": [
	[ /* runs for LI #1 */ ],
	[ /* runs for LI #2 */ ]
  ]
}
```

- `ordered` (`boolean`): `true` for `<ol>`, `false` for `<ul>`
- `items` (`array<array<run>>`): each list item is an array of runs.

### 2.5 Table block

```json
{
  "id": "b5",
  "type": "table",
	"tableWidth": 640,
	"cellPadding": 6,
  "cellBorderWidth": 1,
  "cellBorderColor": "rgb(204, 204, 204)",
  "columnWidths": [220, 420],
  "rowHeights": [42, 36],
	"cellMeta": [
	[
	  { "isHeader": true, "colSpan": 2 },
	  null
	],
	[
	  null,
	  { "rowSpan": 2 }
	]
  ],
	"cellStyles": [
	[
	  { "backgroundColor": "#fef3c7", "verticalAlign": "middle" },
	  null
	],
	[
	  null,
	  { "verticalAlign": "bottom" }
	]
  ],
  "rows": [
    [
      [ { "text": "R1C1" } ],
      [ { "text": "R1C2" } ]
    ],
    [
      [ { "text": "R2C1" } ],
      [ { "text": "R2C2" } ]
    ]
  ]
}
```

- `rows` (`array<array<array<run>>>`): table rows -> cells -> inline runs.
- `tableWidth` (`number`, optional): explicit table width in px when user resizes table border.
- `cellPadding` (`number`, optional): shared cell padding in px from the table cell style preset.
- `cellBorderWidth` (`number`, optional): shared border width in px from the table cell style preset.
- `cellBorderColor` (`string`, optional): shared border color from the table cell style preset.
- `columnWidths` (`array<number>`, optional): per-column pixel widths when user resizes vertical cell borders.
- `rowHeights` (`array<number>`, optional): per-row pixel heights when user resizes horizontal cell borders.
- `cellMeta` (`array<array<object|null>>`, optional): per-cell structural metadata aligned with `rows` indexes.
  - `colSpan` (`number`, optional): colspan value for merged cells.
  - `rowSpan` (`number`, optional): rowspan value for merged cells.
  - `isHeader` (`boolean`, optional): when `true`, preview renders `<th>`.
- `cellStyles` (`array<array<object|null>>`, optional): per-cell visual style metadata aligned with `rows` indexes.
  - `backgroundColor` (`string`, optional): CSS color used for cell background.
  - `verticalAlign` (`string`, optional): one of `middle` or `bottom` (`top` is treated as default).

### 2.6 Attachment block

```json
{
  "id": "b5",
  "type": "attachment",
  "attachmentId": "optional-id-or-null",
  "src": "https://...",
  "alt": "image alt text"
}
```

- `attachmentId` (`string|null`): from `data-attachment-id`
- `src` (`string|null`): from `<img src>`
- `alt` (`string`): from `<img alt>`, fallback empty string

## 3. Inline run model

Run shape:

```json
{
  "text": "Hello",
  "marks": ["bold", "italic", { "type": "link", "href": "https://example.com" }]
}
```

- `text` (`string`): text content.
- `marks` (`array`, optional): inline formatting.

### Supported marks

- `"bold"`
- `"italic"`
- `"underline"`
- Link object:

```json
{ "type": "link", "href": "https://example.com" }
```

### Line breaks

`<br>` is emitted as a run with `"text": "\n"`.

## 4. Mapping from HTML/editor to JSON (current)

- `H1/H2/H3` -> `heading`
- `P` -> `paragraph`
- `BLOCKQUOTE` -> `blockquote`
- `UL/OL` -> `list`
- `TABLE` -> `table`
- `IMG` -> `attachment`
- Block `align` comes from element `style.textAlign` (when set).
- Plain text nodes (non-empty) at root -> `paragraph`
- Unknown element tags currently fall back to `paragraph` with extracted runs.

## 5. Full example

```json
{
  "schema": "we-content",
  "version": 1,
  "meta": {
	"title": "My Article",
	"language": "en-US"
  },
  "blocks": [
	{
	  "id": "b1",
	  "type": "heading",
	  "level": 1,
	  "content": [
		{ "text": "My Article" }
	  ]
	},
	{
	  "id": "b2",
	  "type": "paragraph",
	  "content": [
		{ "text": "This is ", "marks": ["italic"] },
		{ "text": "WebEditor", "marks": ["bold"] },
		{ "text": " content." }
	  ]
	},
	{
	  "id": "b3",
	  "type": "list",
	  "ordered": true,
	  "items": [
		[{ "text": "First" }],
		[{ "text": "Second", "marks": [{ "type": "link", "href": "https://example.com" }] }]
	  ]
	}
  ]
}
```

## 6. Notes for integration

- JSON producer currently uses **camelCase** field names.
- C# models use PascalCase and are deserialized with case-insensitive options in UI paths.
- Toolbar alignment commands map to `justifyLeft`, `justifyCenter`, `justifyRight`, `justifyFull`; persisted JSON values are `left`, `center`, `right`, `justify`.
- For future versioning, treat `schema` + `version` as compatibility keys.
