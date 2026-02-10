using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Enum;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserController : ControllerBase
    {
        private readonly AkordishKeitDbContext _context;

        public UserController(AkordishKeitDbContext context)
        {
            _context = context;
        }

        [HttpGet("stats")]
        public async Task<ActionResult<UserStatsDto>> GetUserStats()
        {
            var stats = new UserStatsDto
            {
                TotalUsers = await _context.Users.CountAsync(u => u.Role == UserRole.Regular),
                TotalAdmins = await _context.Users.CountAsync(u => u.Role == UserRole.Admin || u.Role == UserRole.Manager),
                TotalTeachers = await _context.Users.CountAsync(u => u.Role == UserRole.Teacher),
                TotalArtists = await _context.Users.CountAsync(u => u.Role == UserRole.Artist)
            };
            return Ok(stats);
        }

        [HttpGet("recent-joins")]
        public async Task<ActionResult<IEnumerable<RecentJoinDto>>> GetRecentJoins()
        {
            var recentUsers = await _context.Users
                .OrderByDescending(u => u.CreatedAt)
                .Take(5)
                .Select(u => new RecentJoinDto
                {
                    Name = u.Username,
                    Date = u.CreatedAt,
                    Type = u.Role.ToString(),
                    ProfileImageUrl = u.ProfileImageUrl
                })
                .ToListAsync();

            return Ok(recentUsers);
        }
    }
}
