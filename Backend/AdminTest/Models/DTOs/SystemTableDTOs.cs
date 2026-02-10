namespace AkordishKeit.Models.DTOs;

// Base DTO for simple system tables (Genre, Tag, ArticleCategory)
public class SystemItemDto
{
    public int Id { get; set; }
    public string Name { get; set; }
}

// DTO for creating/updating simple system tables
public class CreateSystemItemDto
{
    public string Name { get; set; }
}

// DTO for Instrument (has additional EnglishName field)
public class InstrumentDto
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string? EnglishName { get; set; }
}

// DTO for creating/updating Instrument
public class CreateInstrumentDto
{
    public string Name { get; set; }
    public string? EnglishName { get; set; }
}

// DTO for MusicServiceProviderCategory
public class MusicServiceProviderCategoryDto
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string? Description { get; set; }
    public string? IconUrl { get; set; }
    public bool IsActive { get; set; }
}

// DTO for creating/updating MusicServiceProviderCategory
public class CreateMusicServiceProviderCategoryDto
{
    public string Name { get; set; }
    public string? Description { get; set; }
    public string? IconUrl { get; set; }
    public bool IsActive { get; set; }
}

// DTO for City
public class CityDto
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string? EnglishName { get; set; }
    public string? District { get; set; }
    public int? Population { get; set; }
    public bool IsActive { get; set; }
}

// DTO for creating/updating City
public class CreateCityDto
{
    public string Name { get; set; }
    public string? EnglishName { get; set; }
    public string? District { get; set; }
    public int? Population { get; set; }
    public bool IsActive { get; set; } = true;
}
