namespace AkordishKeit.Models.Entities;

public class BumpSchedule
{
    public int Id { get; set; }

    public string EntityType { get; set; } = string.Empty;

    public int EntityId { get; set; }

    public int TotalTimes { get; set; }

    public int RemainingTimes { get; set; }

    public int IntervalHours { get; set; }

    public DateTime NextBumpAt { get; set; }

    public DateTime CreatedAt { get; set; }
}
