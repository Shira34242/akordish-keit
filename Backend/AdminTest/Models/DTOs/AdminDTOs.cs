namespace AkordishKeit.Models.DTOs
{
    public class UserStatsDto
    {
        [System.Text.Json.Serialization.JsonPropertyName("totalUsers")]
        public int TotalUsers { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("totalAdmins")]
        public int TotalAdmins { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("totalTeachers")]
        public int TotalTeachers { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("totalArtists")]
        public int TotalArtists { get; set; }
    }

    public class RecentJoinDto
    {
        [System.Text.Json.Serialization.JsonPropertyName("name")]
        public string Name { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("date")]
        public DateTime Date { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("type")]
        public string Type { get; set; }

        [System.Text.Json.Serialization.JsonPropertyName("profileImageUrl")]
        public string? ProfileImageUrl { get; set; }
    }
}
