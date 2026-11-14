using System.Net;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using WebEditor.Models;
using WebEditor.Services;

namespace WebEditor.Tests;

public class StorageServiceTests
{
    private static readonly Guid Tenant = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Folder = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid Image = Guid.Parse("33333333-3333-3333-3333-333333333333");

    [Fact]
    public async Task Upload_sends_multipart_fields_and_returns_storage_id()
    {
        string? body = null;
        var handler = new StubHandler(async request =>
        {
            Assert.Equal(HttpMethod.Post, request.Method);
            Assert.Equal("/api/objects", request.RequestUri!.AbsolutePath);
            Assert.Equal("multipart/form-data", request.Content!.Headers.ContentType!.MediaType);
            body = await request.Content.ReadAsStringAsync();
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent($"\"{Image:D}\"", Encoding.UTF8, "application/json") };
        });
        var client = CreateClient(handler);

        var result = await client.UploadImageAsync(new MemoryStream(Encoding.UTF8.GetBytes("image-bytes")), "photo.png", "image/png");

        Assert.Equal(Image, result);
        Assert.Contains("TenantId", body);
        Assert.Contains(Tenant.ToString("D"), body);
        Assert.Contains("ParentId", body);
        Assert.Contains(Folder.ToString("D"), body);
        Assert.Contains("displayName", body);
        Assert.Contains("photo.png", body);
        Assert.Contains("name=File", body);
        Assert.Contains("image-bytes", body);
    }

    [Fact]
    public async Task Upload_rejects_missing_folder_and_unsupported_image_types()
    {
        var handler = new StubHandler(_ => throw new InvalidOperationException("Should not call storage."));
        var missingFolder = new StorageServiceClient(new HttpClient(handler) { BaseAddress = new Uri("https://storage.test") }, Options.Create(new StorageServiceOptions { TenantId = Tenant }));
        await Assert.ThrowsAsync<InvalidOperationException>(() => missingFolder.UploadImageAsync(Stream.Null, "x.png", "image/png"));
        await Assert.ThrowsAsync<InvalidOperationException>(() => CreateClient(handler).UploadImageAsync(Stream.Null, "x.svg", "image/svg+xml"));
    }

    [Fact]
    public async Task Upload_surfaces_storage_failure()
    {
        var client = CreateClient(new StubHandler(_ => Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadRequest))));
        await Assert.ThrowsAsync<HttpRequestException>(() => client.UploadImageAsync(Stream.Null, "x.png", "image/png"));
    }

    [Fact]
    public void Document_attachments_are_distinct_and_invalid_ids_fail()
    {
        var document = new DocumentModel { Blocks = [
            new DocumentBlock { Type = "attachment", AttachmentId = Image.ToString() },
            new DocumentBlock { Type = "attachment", AttachmentId = Image.ToString() },
            new DocumentBlock { Type = "attachment", Src = "data:image/png;base64,abc" },
            new DocumentBlock { Type = "paragraph", AttachmentId = Folder.ToString() }
        ] };
        Assert.Equal(new[] { Image }, DocumentAttachments.GetIds(document));
        document.Blocks.Add(new DocumentBlock { Type = "attachment", AttachmentId = "not-a-guid" });
        Assert.Throws<InvalidOperationException>(() => DocumentAttachments.GetIds(document));
    }

    [Fact]
    public async Task Download_proxies_the_configured_tenant_and_image_bytes()
    {
        var handler = new StubHandler(request =>
        {
            Assert.Equal(HttpMethod.Get, request.Method);
            Assert.Equal($"/api/objects/{Image:D}/file", request.RequestUri!.AbsolutePath);
            Assert.Equal($"?tenantId={Tenant:D}", request.RequestUri.Query);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = new ByteArrayContent([1, 2, 3]) { Headers = { ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/png") } } });
        });
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.AddSingleton(CreateClient(handler));
        }));
        using var client = factory.CreateClient();
        using var response = await client.GetAsync($"/storage/images/{Image:D}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/png", response.Content.Headers.ContentType!.MediaType);
        Assert.Equal(new byte[] { 1, 2, 3 }, await response.Content.ReadAsByteArrayAsync());
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
    }

    [Theory]
    [InlineData(HttpStatusCode.NotFound, "image/png", HttpStatusCode.NotFound)]
    [InlineData(HttpStatusCode.OK, "text/html", HttpStatusCode.UnsupportedMediaType)]
    public async Task Download_rejects_storage_errors_and_non_image_content(HttpStatusCode storageStatus, string contentType, HttpStatusCode expectedStatus)
    {
        var handler = new StubHandler(_ => Task.FromResult(new HttpResponseMessage(storageStatus)
        {
            Content = new StringContent("unexpected content", Encoding.UTF8, contentType)
        }));
        await using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.AddSingleton(CreateClient(handler));
        }));
        using var client = factory.CreateClient();
        using var response = await client.GetAsync($"/storage/images/{Image:D}");
        Assert.Equal(expectedStatus, response.StatusCode);
        Assert.DoesNotContain("unexpected content", await response.Content.ReadAsStringAsync());
    }

    private static StorageServiceClient CreateClient(HttpMessageHandler handler) =>
        new(new HttpClient(handler) { BaseAddress = new Uri("https://storage.test") }, Options.Create(new StorageServiceOptions { TenantId = Tenant, AttachmentFolderId = Folder }));

    private sealed class StubHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> send) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => send(request);
    }
}
