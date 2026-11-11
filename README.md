# WebEditor

WebEditor is a .NET 10 Blazor Server app for writing rich content, generating **Document JSON** (`we-content` schema), and saving/retrieving articles through ArticleService.

## Features

- Rich text editor with:
  - Undo / Redo
  - Bold / Italic / Underline
  - Bullet / Numbered lists
  - Headings (H1/H2/H3)
  - Text alignment (left/center/right/justify)
  - Link insert / edit / remove
  - Clear formatting
- Live output panes for:
  - HTML output
  - Document JSON output
- Article workflow:
  - **Home**: list articles from ArticleService and click row to inspect content
  - **Add Article**: create and save article content to ArticleService

## Prerequisites

- .NET SDK 10.0+
- Running ArticleService instance

## Configuration

Configure `ArticleService` in `WebEditor/appsettings.json` or `WebEditor/appsettings.Development.json`:

```json
"ArticleService": {
  "BaseUrl": "http://localhost:32768",
  "TenantId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

## Run

From repo root:

```bash
dotnet run --project .\WebEditor\WebEditor.csproj
```

Then open the app URL shown in console.

## Test

```bash
dotnet test .\WebEditor.Tests\WebEditor.Tests.csproj
```

## Document JSON specification

- Local spec: `WebEditor/Docs/document-json-spec.md`
- Confluence: https://imageblue.atlassian.net/wiki/spaces/IMAGEBLUE/pages/239173633/Document+JSON+Specification

## Solution structure

- `WebEditor/` - Blazor app
- `WebEditor.Tests/` - xUnit tests
- `WebEditor/Services/` - ArticleService client/integration
- `WebEditor/Components/` - pages/layout/editor component
- `WebEditor/wwwroot/js/editor.js` - editor behavior and JSON generation
