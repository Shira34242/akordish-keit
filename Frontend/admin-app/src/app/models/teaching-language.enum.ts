export enum TeachingLanguage {
  None = 0,
  Hebrew = 1,      // 1
  English = 2,     // 2
  Russian = 4,     // 4
  Arabic = 8,      // 8
  French = 16,     // 16
  Spanish = 32,    // 32
  Italian = 64,    // 64
  German = 128,    // 128
  Yiddish = 256,   // 256
  Amharic = 512    // 512
}

export const TeachingLanguageLabels: { [key in TeachingLanguage]: string } = {
  [TeachingLanguage.None]: 'ללא',
  [TeachingLanguage.Hebrew]: 'עברית',
  [TeachingLanguage.English]: 'אנגלית',
  [TeachingLanguage.Russian]: 'רוסית',
  [TeachingLanguage.Arabic]: 'ערבית',
  [TeachingLanguage.French]: 'צרפתית',
  [TeachingLanguage.Spanish]: 'ספרדית',
  [TeachingLanguage.Italian]: 'איטלקית',
  [TeachingLanguage.German]: 'גרמנית',
  [TeachingLanguage.Yiddish]: 'יידיש',
  [TeachingLanguage.Amharic]: 'אמהרית'
};

// Helper function to get all language options
export function getTeachingLanguageOptions(): { value: TeachingLanguage, label: string }[] {
  return Object.keys(TeachingLanguage)
    .filter(key => !isNaN(Number(key)) && Number(key) !== TeachingLanguage.None)
    .map(key => ({
      value: Number(key) as TeachingLanguage,
      label: TeachingLanguageLabels[Number(key) as TeachingLanguage]
    }));
}

// Helper function to check if a specific language is selected
export function hasLanguage(languages: number | null | undefined, language: TeachingLanguage): boolean {
  if (!languages) return false;
  return (languages & language) === language;
}

// Helper function to toggle a language
export function toggleLanguage(languages: number | null | undefined, language: TeachingLanguage): number {
  const current = languages || 0;
  return current ^ language;
}
