/**
 * מודל להופעה/אירוע מוזיקלי
 */
export interface Event {
  id: number;
  name: string;
  description?: string;
  imageUrl: string;
  ticketUrl: string;
  eventDate: string; // ISO 8601 date string
  location?: string;

  // שם אומן חופשי (טקסט) - למקרה שהאומן לא קיים במערכת
  artistName?: string;

  // אומנים מתוייגים מהמערכת
  taggedArtists: EventArtist[];

  price?: number;
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;

  // Calculated fields
  daysUntilEvent: number;
  isToday: boolean;
  isPast: boolean;
  eventStatus: string; // "היום" / "אירוע שחלף" / "עוד X ימים"
}

/**
 * אומן מתוייג בהופעה
 */
export interface EventArtist {
  artistId: number;
  artistName: string;
  artistImageUrl?: string;
}

/**
 * DTO ליצירת הופעה חדשה
 */
export interface CreateEventDto {
  name: string;
  description?: string;
  imageUrl: string;
  ticketUrl: string;
  eventDate: string;
  location?: string;

  // שם אומן חופשי (טקסט) - למקרה שהאומן לא קיים במערכת
  artistName?: string;

  // רשימת IDs של אומנים לתיוג (מהמערכת)
  artistIds?: number[];

  price?: number;
  displayOrder?: number;
  isActive?: boolean;
}

/**
 * DTO לעדכון הופעה
 */
export interface UpdateEventDto {
  name: string;
  description?: string;
  imageUrl: string;
  ticketUrl: string;
  eventDate: string;
  location?: string;

  // שם אומן חופשי (טקסט) - למקרה שהאומן לא קיים במערכת
  artistName?: string;

  // רשימת IDs של אומנים לתיוג (מהמערכת)
  // אם מסופק, מחליף את הרשימה הקיימת
  artistIds?: number[];

  price?: number;
  displayOrder?: number;
  isActive?: boolean;
}

/**
 * DTO להופעות קרובות (לדף הראשי)
 */
export interface UpcomingEventDto {
  id: number;
  name: string;
  imageUrl: string;
  ticketUrl: string;
  eventDate: string;
  location?: string;

  // שם אומן חופשי (טקסט)
  artistName?: string;

  // שמות אומנים מתוייגים
  taggedArtistNames: string[];

  daysUntilEvent: number;
  eventStatus: string;
}
