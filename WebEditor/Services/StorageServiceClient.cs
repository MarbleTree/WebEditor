using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.Extensions.Options;

namespace WebEditor.Services;

public sealed class StorageServiceClient(HttpClient httpClient, IOptions<StorageServiceOptions> options)
{
    private readonly StorageServiceOptions _options = options.Value;

    public static bool IsSupportedImageType(string? contentType) =>
        contentType?.ToLowerInvariant() is "image/jpeg" or "image/png" or "image/gif" or "image/webp" or "image/avif";

    public async Task<Guid> UploadImageAsync(Stream stream, string fileName, string contentType, CancellationToken cancellationToken = default)
    {
        if (_options.TenantId == Guid.Empty || _options.AttachmentFolderId == Guid.Empty)
        {
            throw new InvalidOperationException("Configure StorageService TenantId and AttachmentFolderId before uploading images.");
        }

        if (!IsSupportedImageType(contentType))
        {
            throw new InvalidOperationException("Only JPEG, PNG, GIF, WebP and AVIF images can be uploaded.");
        }

        using var form = new MultipartFormDataContent();
        form.Add(new StringContent(_options.TenantId.ToString("D")), "TenantId");
        form.Add(new StringContent(_options.AttachmentFolderId.ToString("D")), "ParentId");
        form.Add(new StringContent(fileName), "displayName");
        var fileContent = new StreamContent(stream);
        fileContent.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        form.Add(fileContent, "File", fileName);
        using var response = await httpClient.PostAsync("/api/objects", form, cancellationToken);
        response.EnsureSuccessStatusCode();
        var id = await response.Content.ReadFromJsonAsync<Guid>(cancellationToken);
        return id != Guid.Empty ? id : throw new InvalidOperationException("StorageService returned an empty image ID.");
    }

    public Task<HttpResponseMessage> GetImageAsync(Guid id, CancellationToken cancellationToken = default)
    {
        if (_options.TenantId == Guid.Empty)
        {
            throw new InvalidOperationException("Configure StorageService TenantId before downloading images.");
        }

        return httpClient.GetAsync($"/api/objects/{id:D}/file?tenantId={_options.TenantId:D}", HttpCompletionOption.ResponseHeadersRead, cancellationToken);
    }
}
