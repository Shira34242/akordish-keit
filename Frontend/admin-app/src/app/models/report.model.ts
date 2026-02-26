export interface CreateReportDto {
    contentType: 'Song' | 'Article' | 'BlogPost' | 'General';
    contentId: number;
    reportType: 'ContentError' | 'InappropriateContent' | 'Other';
    description: string;
}

export interface Report {
    id: number;
    contentType: string;
    contentId: number;
    contentTitle: string;
    contentUrl: string;
    reportType: string;
    description: string;
    reportedAt: Date;
    status: 'Pending' | 'Resolved' | 'Dismissed';
    reporterUsername?: string;
    resolvedAt?: Date;
    resolvedByUsername?: string;
    adminNotes?: string;
}

export interface UpdateReportStatusDto {
    status: 'Resolved' | 'Dismissed';
    adminNotes?: string;
}

export const ReportTypeLabels: Record<string, string> = {
    'ContentError': 'טעות בתוכן',
    'InappropriateContent': 'תוכן לא ראוי',
    'Other': 'אחר',
    'NewArtist': 'אמן חדש',
    'NewGenre': 'ז\'אנרים שירים',
    'NewTag': 'תגיות שירים',
    'NewPerson': 'מלחין חדש'
};

export const ContentTypeLabels: Record<string, string> = {
    'Song': 'אקורדים',
    'Article': 'כתבה',
    'BlogPost': 'בלוג',
    'General': 'הודעה כללית',
    'Genre': 'הוספת מידע חדש למערכת',
    'Tag': 'הוספת מידע חדש למערכת',
    'Person': 'הוספת מידע חדש למערכת',
    'NewContent': 'הוספת מידע חדש למערכת'
};

export const StatusLabels: Record<string, string> = {
    'Pending': 'ממתין',
    'Resolved': 'טופל',
    'Dismissed': 'נדחה'
};
