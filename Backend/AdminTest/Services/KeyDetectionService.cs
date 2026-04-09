using System.Text.RegularExpressions;

namespace AkordishKeit.Services;

/// <summary>
/// זיהוי סולם שיר מתוך אקורדים בפורמט [Am] [C] [F#m]
/// אלגוריתם: ניקוד כל 24 הסולמות לפי תדירות האקורדים הדיאטוניים
/// סיבוכיות: O(n) לפיענוח + O(24 * unique_chords) לניקוד — מאוד יעיל
/// </summary>
public static class KeyDetectionService
{
    // מיפוי שם תו → semitone (0–11)
    private static readonly Dictionary<string, int> NoteToSemitone = new(StringComparer.OrdinalIgnoreCase)
    {
        ["C"] = 0, ["B#"] = 0,
        ["C#"] = 1, ["Db"] = 1,
        ["D"] = 2,
        ["D#"] = 3, ["Eb"] = 3,
        ["E"] = 4, ["Fb"] = 4,
        ["F"] = 5, ["E#"] = 5,
        ["F#"] = 6, ["Gb"] = 6,
        ["G"] = 7,
        ["G#"] = 8, ["Ab"] = 8,
        ["A"] = 9,
        ["A#"] = 10, ["Bb"] = 10,
        ["B"] = 11, ["Cb"] = 11
    };

    // 24 הסולמות — מקביל ל-MusicalKeySeed.cs
    private static readonly (int Id, int Semitone, bool IsMinor)[] AllKeys =
    [
        (1,  0,  false), // C
        (2,  1,  false), // C#
        (3,  2,  false), // D
        (4,  3,  false), // D#
        (5,  4,  false), // E
        (6,  5,  false), // F
        (7,  6,  false), // F#
        (8,  7,  false), // G
        (9,  8,  false), // G#
        (10, 9,  false), // A
        (11, 10, false), // A#
        (12, 11, false), // B
        (13, 9,  true),  // Am
        (14, 10, true),  // A#m
        (15, 11, true),  // Bm
        (16, 0,  true),  // Cm
        (17, 1,  true),  // C#m
        (18, 2,  true),  // Dm
        (19, 3,  true),  // D#m
        (20, 4,  true),  // Em
        (21, 5,  true),  // Fm
        (22, 6,  true),  // F#m
        (23, 7,  true),  // Gm
        (24, 8,  true)   // G#m
    ];

    // מרווחים ומשקלים לסולם מז'ור: I ii iii IV V vi vii°
    private static readonly int[] MajorIntervals = [0, 2, 4, 5, 7, 9, 11];
    private static readonly bool[] MajorQualities = [false, true, true, false, false, true, true];
    private static readonly int[] MajorWeights   = [4, 2, 2, 3, 3, 2, 1];

    // מרווחים ומשקלים לסולם מינור: i ii° III iv v VI VII
    private static readonly int[] MinorIntervals = [0, 2, 3, 5, 7, 8, 10];
    private static readonly bool[] MinorQualities = [true, true, false, true, true, false, false];
    private static readonly int[] MinorWeights   = [4, 1, 2, 3, 3, 2, 2];

    // רגקס לחילוץ אקורדים מהפורמט [Am] [C#m7] [F#/C]
    private static readonly Regex ChordRegex = new(
        @"\[([A-G][b#]?[^\]/\[]*?)(?:/[A-G][b#]?)?\]",
        RegexOptions.Compiled);

    // רגקס לחילוץ שורש האקורד
    private static readonly Regex RootRegex = new(@"^([A-G][b#]?)", RegexOptions.Compiled);

    public static KeyDetectionResult? Detect(string lyricsWithChords)
    {
        if (string.IsNullOrWhiteSpace(lyricsWithChords))
            return null;

        // 1. חילוץ וספירת אקורדים ייחודיים
        var chordCounts = new Dictionary<(int Semitone, bool IsMinor), int>();

        foreach (Match m in ChordRegex.Matches(lyricsWithChords))
        {
            var raw = m.Groups[1].Value.Trim();
            if (TryParseChord(raw, out int semitone, out bool isMinor))
            {
                var key = (semitone, isMinor);
                chordCounts[key] = chordCounts.GetValueOrDefault(key) + 1;
            }
        }

        if (chordCounts.Count == 0)
            return null;

        // 2. ניקוד כל 24 הסולמות
        int bestId = -1;
        double bestScore = -1;
        bool bestIsMinor = false;

        foreach (var (id, rootSemitone, isMinor) in AllKeys)
        {
            double score = ScoreKey(rootSemitone, isMinor, chordCounts);
            if (score > bestScore)
            {
                bestScore = score;
                bestId = id;
                bestIsMinor = isMinor;
            }
        }

        if (bestId == -1)
            return null;

        // 3. סולם קל לנגינה: Am (id=13) למינור, C (id=1) למז'ור
        int easyKeyId = bestIsMinor ? 13 : 1;

        return new KeyDetectionResult
        {
            OriginalKeyId = bestId,
            EasyKeyId = easyKeyId
        };
    }

    private static double ScoreKey(int rootSemitone, bool isMinor,
        Dictionary<(int Semitone, bool IsMinor), int> chordCounts)
    {
        int[] intervals = isMinor ? MinorIntervals : MajorIntervals;
        bool[] qualities = isMinor ? MinorQualities : MajorQualities;
        int[] weights   = isMinor ? MinorWeights   : MajorWeights;

        double score = 0;

        for (int degree = 0; degree < 7; degree++)
        {
            int chordRoot = (rootSemitone + intervals[degree]) % 12;
            bool expectedMinor = qualities[degree];

            // ניקוד מלא לאקורד דיאטוני
            if (chordCounts.TryGetValue((chordRoot, expectedMinor), out int count))
                score += count * weights[degree];

            // ניקוד חלקי לווריאנט מז'ור/מינור של אותו שורש (אקורדי pivot)
            if (chordCounts.TryGetValue((chordRoot, !expectedMinor), out int altCount))
                score += altCount * weights[degree] * 0.3;
        }

        // בונוס למינור הרמוני: V מז'ור (degree 4 = semitone+7)
        if (isMinor)
        {
            int vRoot = (rootSemitone + 7) % 12;
            if (chordCounts.TryGetValue((vRoot, false), out int vCount))
                score += vCount * 2.5;
        }

        return score;
    }

    private static bool TryParseChord(string chord, out int semitone, out bool isMinor)
    {
        semitone = 0;
        isMinor = false;

        if (string.IsNullOrWhiteSpace(chord))
            return false;

        var rootMatch = RootRegex.Match(chord);
        if (!rootMatch.Success)
            return false;

        string root = rootMatch.Groups[1].Value;
        if (!NoteToSemitone.TryGetValue(root, out semitone))
            return false;

        string suffix = chord[root.Length..];

        // minor: אם מתחיל ב-m אבל לא maj/min (maj7, major...)
        if (suffix.StartsWith("dim", StringComparison.OrdinalIgnoreCase))
            isMinor = true; // dim מתנהג כמינור לצורך ניקוד
        else
            isMinor = suffix.Length > 0
                      && suffix[0] == 'm'
                      && (suffix.Length < 2 || suffix[1] != 'a'); // לא maj

        return true;
    }
}

public class KeyDetectionResult
{
    public int OriginalKeyId { get; set; }
    public int EasyKeyId { get; set; }
}
