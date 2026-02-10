using AkordishKeit.Data;
using AkordishKeit.Models.DTOs;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.Enums;
using AkordishKeit.Extensions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ClientsController : ControllerBase
    {
        private readonly AkordishKeitDbContext _context;

        public ClientsController(AkordishKeitDbContext context)
        {
            _context = context;
        }

        // GET: api/Clients
        [HttpGet]
        public async Task<ActionResult<PagedResult<ClientDto>>> GetClients(
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10)
        {
            var clientsQuery = _context.Clients
                .Where(c => !c.IsActive || c.IsActive) // Get all
                .Select(c => new ClientDto
                {
                    Id = c.Id,
                    BusinessName = c.BusinessName,
                    ContactPerson = c.ContactPerson,
                    Email = c.Email,
                    Phone = c.Phone,
                    LogoUrl = c.LogoUrl,
                    IsActive = c.IsActive,
                    CreatedAt = c.CreatedAt,
                    UpdatedAt = c.UpdatedAt,
                    TotalCampaigns = c.Campaigns.Count,
                    ActiveCampaigns = c.Campaigns.Count(camp => camp.Status == AdCampaignStatus.Active),
                    TotalBudget = c.Campaigns.Sum(camp => camp.Budget)
                })
                .OrderByDescending(c => c.CreatedAt);

            var pagedResult = await clientsQuery.ToPagedResultAsync(pageNumber, pageSize);

            return Ok(pagedResult);
        }

        // GET: api/Clients/5
        [HttpGet("{id}")]
        public async Task<ActionResult<ClientDto>> GetClient(int id)
        {
            var client = await _context.Clients
                .Where(c => c.Id == id)
                .Select(c => new ClientDto
                {
                    Id = c.Id,
                    BusinessName = c.BusinessName,
                    ContactPerson = c.ContactPerson,
                    Email = c.Email,
                    Phone = c.Phone,
                    LogoUrl = c.LogoUrl,
                    IsActive = c.IsActive,
                    CreatedAt = c.CreatedAt,
                    UpdatedAt = c.UpdatedAt,
                    TotalCampaigns = c.Campaigns.Count,
                    ActiveCampaigns = c.Campaigns.Count(camp => camp.Status == AdCampaignStatus.Active),
                    TotalBudget = c.Campaigns.Sum(camp => camp.Budget)
                })
                .FirstOrDefaultAsync();

            if (client == null)
            {
                return NotFound();
            }

            return Ok(client);
        }

        // POST: api/Clients
        [HttpPost]
        public async Task<ActionResult<ClientDto>> CreateClient(CreateClientDto dto)
        {
            // Check if email already exists
            if (await _context.Clients.AnyAsync(c => c.Email == dto.Email))
            {
                return BadRequest(new { message = "Email already exists" });
            }

            var client = new Client
            {
                BusinessName = dto.BusinessName,
                ContactPerson = dto.ContactPerson,
                Email = dto.Email,
                Phone = dto.Phone,
                LogoUrl = dto.LogoUrl,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Clients.Add(client);
            await _context.SaveChangesAsync();

            var clientDto = new ClientDto
            {
                Id = client.Id,
                BusinessName = client.BusinessName,
                ContactPerson = client.ContactPerson,
                Email = client.Email,
                Phone = client.Phone,
                LogoUrl = client.LogoUrl,
                IsActive = client.IsActive,
                CreatedAt = client.CreatedAt,
                TotalCampaigns = 0,
                ActiveCampaigns = 0,
                TotalBudget = 0
            };

            return CreatedAtAction(nameof(GetClient), new { id = client.Id }, clientDto);
        }

        // PUT: api/Clients/5
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateClient(int id, UpdateClientDto dto)
        {
            var client = await _context.Clients.FindAsync(id);

            if (client == null)
            {
                return NotFound();
            }

            // Check if email already exists (excluding current client)
            if (await _context.Clients.AnyAsync(c => c.Email == dto.Email && c.Id != id))
            {
                return BadRequest(new { message = "Email already exists" });
            }

            client.BusinessName = dto.BusinessName;
            client.ContactPerson = dto.ContactPerson;
            client.Email = dto.Email;
            client.Phone = dto.Phone;
            client.LogoUrl = dto.LogoUrl;
            client.IsActive = dto.IsActive;
            client.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE: api/Clients/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteClient(int id)
        {
            var client = await _context.Clients
                .Include(c => c.Campaigns)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (client == null)
            {
                return NotFound();
            }

            // Check if client has active campaigns
            if (client.Campaigns.Any(c => c.Status == AdCampaignStatus.Active))
            {
                return BadRequest(new { message = "Cannot delete client with active campaigns" });
            }

            _context.Clients.Remove(client);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
