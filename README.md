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
- Running StorageService instance and an existing attachment folder for uploading large images

## Configuration

Configure `ArticleService` in `WebEditor/appsettings.json` or `WebEditor/appsettings.Development.json`:

```json
"ArticleService": {
  "BaseUrl": "http://localhost:32772",
  "TenantId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}
```

Configure StorageService with the existing folder ID and the same tenant ID used by ArticleService:

```json
"StorageService": {
  "BaseUrl": "https://localhost:32805",
  "TenantId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "AttachmentFolderId": "588fb695-8ef0-4d8f-b044-c6e01733c00b",
  "MaxImageBytes": 31457280
}
```

These IDs are configured for the local service; change them for other environments. The server must trust the StorageService HTTPS certificate. Images up to 50 KiB are embedded; larger JPEG, PNG, GIF, WebP and AVIF images are uploaded, up to `MaxImageBytes` (30 MiB by default). The article stores the referenced object IDs, and WebEditor proxies downloads for display. Deleting an image from the document removes its reference on the next save, but does not delete the uploaded storage object. Failed or abandoned drafts can also leave unused objects. The download route uses the configured tenant and, like the existing app, does not implement user authentication or per-article authorization; restrict access appropriately before exposing it.

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
   - `Services/StorageServiceClient.cs`, `Services/StorageServiceOptions.cs`, and `Services/ArticleServiceOptions.cs`
   - `wwwroot/js/editor.js`
   - `wwwroot/css/editor.css`
   - Register `StorageServiceClient` and its options as in `Program.cs`, even if uploads are disabled.
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

The component defaults to a hosted-URL prompt for images above the inline limit. The Add Article page enables `EnableStorageUploads`; another host opting in must also register the storage client and options, configure matching tenants and a folder, and provide the `storage/images/{id}` download route.

## Document JSON specification

- Local spec: `WebEditor/Docs/document-json-spec.md`
- Confluence: https://imageblue.atlassian.net/wiki/spaces/IMAGEBLUE/pages/239173633/Document+JSON+Specification

## Solution structure

- `WebEditor/` - Blazor app
- `WebEditor.Tests/` - xUnit tests
- `WebEditor/Services/` - ArticleService client/integration
- `WebEditor/Components/` - pages/layout/editor component
- `WebEditor/wwwroot/js/editor.js` - editor behavior and JSON generation
