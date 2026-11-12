# WebEditor

WebEditor is a .NET 10 Blazor Server app for writing rich content, generating **Document JSON** (`we-content` schema), and saving/retrieving articles through ArticleService.

## Features

- Rich text editor with:
  - Undo / Redo
  - Bold / Italic / Underline
  - Bullet / Numbered lists
  - Table insert (up to 8x8) + row/column add/remove
  - Headings (H1/H2/H3)
  - Text alignment (left/center/right/justify)
  - Link insert / edit / remove
  - Clear formatting
- Optional built-in output panes for:
  - HTML output
  - Document JSON output
- Reusable component API:
  - `@bind-Value` for document JSON
  - `ShowToolbar`, `ShowBuiltInOutputs`, `ShowComponentTitle` options
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
  "BaseUrl": "https://localhost:32773",
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

## Reusing `WebEditor` in another Blazor project

1. Copy these assets/components (or package them in an RCL):
   - `Components/WebEditor.razor`
   - `wwwroot/js/editor.js`
   - `wwwroot/css/editor.css`
2. Include static files in your app layout (`App.razor`/host page):

```html
<link rel="stylesheet" href="css/editor.css" />
<script src="js/editor.js"></script>
```

3. Use the component:

```razor
<WebEditor
    @bind-Value="DocumentJson"
    ShowToolbar="true"
    ShowBuiltInOutputs="false"
    ShowComponentTitle="false"
    OnDocumentChanged="HandleDocumentChanged" />
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
