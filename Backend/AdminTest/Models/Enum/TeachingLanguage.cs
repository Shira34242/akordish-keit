namespace AkordishKeit.Models.Enum;

[Flags]
public enum TeachingLanguage
{
    None = 0,
    Hebrew = 1 << 0,      // 1
    English = 1 << 1,     // 2
    Russian = 1 << 2,     // 4
    Arabic = 1 << 3,      // 8
    French = 1 << 4,      // 16
    Spanish = 1 << 5,     // 32
    Italian = 1 << 6,     // 64
    German = 1 << 7,      // 128
    Yiddish = 1 << 8,     // 256
    Amharic = 1 << 9      // 512
}
