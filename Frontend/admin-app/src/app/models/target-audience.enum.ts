export enum TargetAudience {
  None = 0,
  Children = 1,        // 1 - ילדים (גילאי 3-12)
  Teenagers = 2,       // 2 - נוער (גילאי 13-18)
  Adults = 4,          // 4 - מבוגרים (18+)
  Seniors = 8,         // 8 - גיל הזהב (60+)
  Beginners = 16,      // 16 - מתחילים
  Intermediate = 32,   // 32 - רמה בינונית
  Advanced = 64,       // 64 - מתקדמים
  Professional = 128   // 128 - מקצועיים
}

export const TargetAudienceLabels: { [key in TargetAudience]: string } = {
  [TargetAudience.None]: 'ללא',
  [TargetAudience.Children]: 'ילדים (3-12)',
  [TargetAudience.Teenagers]: 'נוער (13-18)',
  [TargetAudience.Adults]: 'מבוגרים (18+)',
  [TargetAudience.Seniors]: 'גיל הזהב (60+)',
  [TargetAudience.Beginners]: 'מתחילים',
  [TargetAudience.Intermediate]: 'רמה בינונית',
  [TargetAudience.Advanced]: 'מתקדמים',
  [TargetAudience.Professional]: 'מקצועיים'
};

// Helper function to get all target audience options
export function getTargetAudienceOptions(): { value: TargetAudience, label: string }[] {
  return Object.keys(TargetAudience)
    .filter(key => !isNaN(Number(key)) && Number(key) !== TargetAudience.None)
    .map(key => ({
      value: Number(key) as TargetAudience,
      label: TargetAudienceLabels[Number(key) as TargetAudience]
    }));
}

// Helper function to check if a specific audience is selected
export function hasAudience(audiences: number | null | undefined, audience: TargetAudience): boolean {
  if (!audiences) return false;
  return (audiences & audience) === audience;
}

// Helper function to toggle an audience
export function toggleAudience(audiences: number | null | undefined, audience: TargetAudience): number {
  const current = audiences || 0;
  return current ^ audience;
}
