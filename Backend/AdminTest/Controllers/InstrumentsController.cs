using AkordishKeit.Data;
using AkordishKeit.Models.Entities;
using AkordishKeit.Models.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AkordishKeit.Controllers;

[Route("api/[controller]")]
[ApiController]
public class InstrumentsController : ControllerBase
{
    private readonly AkordishKeitDbContext _context;

    public InstrumentsController(AkordishKeitDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<PagedResult<InstrumentDto>>> GetInstruments([FromQuery] int pageNumber = 1, [FromQuery] int pageSize = 10, [FromQuery] string? search = null)
    {
        var query = _context.Instruments.AsQueryable();

        // Apply search filter if provided (search in both Name and EnglishName)
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(i => i.Name.Contains(search) || (i.EnglishName != null && i.EnglishName.Contains(search)));
        }

        var totalCount = await query.CountAsync();

        var instruments = await query
            .OrderBy(i => i.Name)
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .Select(i => new InstrumentDto
            {
                Id = i.Id,
                Name = i.Name,
                EnglishName = i.EnglishName
            })
            .ToListAsync();

        var result = new PagedResult<InstrumentDto>
        {
            Items = instruments,
            TotalCount = totalCount,
            PageNumber = pageNumber,
            PageSize = pageSize
        };

        return result;
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<InstrumentDto>> GetInstrument(int id)
    {
        var instrument = await _context.Instruments
            .Where(i => i.Id == id)
            .Select(i => new InstrumentDto
            {
                Id = i.Id,
                Name = i.Name,
                EnglishName = i.EnglishName
            })
            .FirstOrDefaultAsync();

        if (instrument == null)
        {
            return NotFound();
        }

        return instrument;
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<InstrumentDto>> PostInstrument(CreateInstrumentDto dto)
    {
        var instrument = new Instrument
        {
            Name = dto.Name,
            EnglishName = dto.EnglishName
        };

        _context.Instruments.Add(instrument);
        await _context.SaveChangesAsync();

        var result = new InstrumentDto
        {
            Id = instrument.Id,
            Name = instrument.Name,
            EnglishName = instrument.EnglishName
        };

        return CreatedAtAction("GetInstrument", new { id = instrument.Id }, result);
    }

    [HttpPut("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> PutInstrument(int id, CreateInstrumentDto dto)
    {
        var instrument = await _context.Instruments.FindAsync(id);

        if (instrument == null)
        {
            return NotFound();
        }

        instrument.Name = dto.Name;
        instrument.EnglishName = dto.EnglishName;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!InstrumentExists(id))
            {
                return NotFound();
            }
            else
            {
                throw;
            }
        }

        return NoContent();
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> DeleteInstrument(int id)
    {
        var instrument = await _context.Instruments.FindAsync(id);
        if (instrument == null)
        {
            return NotFound();
        }

        _context.Instruments.Remove(instrument);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    private bool InstrumentExists(int id)
    {
        return _context.Instruments.Any(e => e.Id == id);
    }
}
