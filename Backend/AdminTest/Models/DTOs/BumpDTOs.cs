namespace AkordishKeit.Models.DTOs;

public class BumpRequestDto
{
    public string EntityType { get; set; } = string.Empty;
    public List<int> Ids { get; set; } = new();
    public BumpScheduleDto? Schedule { get; set; }
}

public class BumpScheduleDto
{
    public int Times { get; set; }
    public int IntervalHours { get; set; }
}
