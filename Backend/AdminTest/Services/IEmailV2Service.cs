using AkordishKeit.Models.DTOs;

namespace AkordishKeit.Services;

public interface IEmailV2Service
{
    Task<EmailV2TemplateDto> SaveTemplateAsync(SaveEmailV2TemplateDto dto);
    Task<EmailV2TemplateDto?> GetTemplateAsync(int campaignId);
    Task<List<EmailV2TemplateDto>> GetTemplatesAsync();
    Task<bool> DeleteTemplateAsync(int campaignId);
    Task<EmailV2ConversionResultDto> ConvertToHtmlAsync(string mjml, string? previewText = null);
    Task<EmailV2ConversionResultDto> SendTestEmailAsync(EmailV2SendTestDto dto);
    Task<List<EmailDesignVersionDto>> GetDesignVersionsAsync(int campaignId);
    Task<EmailDesignVersionDto?> GetDesignVersionAsync(int campaignId, int version);
    Task<EmailV2TemplateDto> RestoreDesignVersionAsync(int campaignId, int version);
}
