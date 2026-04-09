-- Seed: 10 example songs for artist מוטי שטינמיץ (ArtistId = 2)
-- Run this script on AkordishKeitDB

SET NOCOUNT ON;

SET IDENTITY_INSERT Songs ON;

INSERT INTO Songs (Id, Title, YouTubeUrl, ImageUrl, IsApproved, LyricsWithChords, OriginalKeyId, Language, IsDeleted, ViewCount, PlayCount, CreatedAt)
VALUES
(8,  N'אני מאמין',
 'https://www.youtube.com/watch?v=6U_5KhaH6IM',
 'https://i.ytimg.com/vi/6U_5KhaH6IM/maxresdefault.jpg',
 1,
 N'Am               G
אני מאמין באמונה שלמה
Dm               Am
בביאת המשיח אחכה לו
F                E
בכל יום שיבוא ויגאלנו
Am               G
אני מאמין אני מאמין',
 13, N'he', 0, 0, 0, GETUTCDATE()),

(9,  N'בן יקיר לי',
 'https://www.youtube.com/watch?v=T5Wf3gmF6Do',
 'https://i.ytimg.com/vi/T5Wf3gmF6Do/maxresdefault.jpg',
 1,
 N'Dm               Am
הבן יקיר לי אפרים
Gm               Dm
אם ילד שעשועים
Bb               F
כי מדי דברי בו
A                Dm
זכור אזכרנו עוד

C                Gm
על כן המו מעי לו
Dm               A
רחם ארחמנו נאם ה׳',
 18, N'he', 0, 0, 0, GETUTCDATE()),

(10, N'שמע ישראל',
 'https://www.youtube.com/watch?v=CBWJG8bRNRg',
 'https://i.ytimg.com/vi/CBWJG8bRNRg/maxresdefault.jpg',
 1,
 N'Am               Dm
שמע ישראל ה׳ אלוקינו
Em               Am
ה׳ אחד

F                C
ברוך שם כבוד מלכותו
G                Am
לעולם ועד',
 13, N'he', 0, 0, 0, GETUTCDATE()),

(11, N'אבינו מלכנו',
 'https://www.youtube.com/watch?v=YlO8g2WZwe8',
 'https://i.ytimg.com/vi/YlO8g2WZwe8/maxresdefault.jpg',
 1,
 N'Dm               Gm
אבינו מלכנו חננו ועננו
Am               Dm
כי אין בנו מעשים

Bb               F
עשה עמנו צדקה וחסד
C                Dm
והושיענו',
 18, N'he', 0, 0, 0, GETUTCDATE()),

(12, N'כי הנה כחומר',
 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
 'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
 1,
 N'Em               Am
כי הנה כחומר ביד היוצר
D                Em
ברצותו מרחיב וברצותו מקצר

G                D
כן אנחנו בידך חסד נוצר
Em               B
לברית הבט ואל תפן ליצר',
 20, N'he', 0, 0, 0, GETUTCDATE()),

(13, N'אל אדון',
 'https://www.youtube.com/watch?v=xvFZjo5PgG0',
 'https://i.ytimg.com/vi/xvFZjo5PgG0/maxresdefault.jpg',
 1,
 N'F                C
אל אדון על כל המעשים
Dm               Am
ברוך ומבורך בפי כל נשמה

Bb               F
גדלו וטובו מלא עולם
C                Dm
דעת ותבונה סובבים הודו',
 6, N'he', 0, 0, 0, GETUTCDATE()),

(14, N'לך דודי',
 'https://www.youtube.com/watch?v=oHg5SJYRHA0',
 'https://i.ytimg.com/vi/oHg5SJYRHA0/maxresdefault.jpg',
 1,
 N'G                D
לכה דודי לקראת כלה
Em               C
פני שבת נקבלה

Am               D
שמור וזכור בדיבור אחד
G                D
השמיענו אל המיוחד',
 8, N'he', 0, 0, 0, GETUTCDATE()),

(15, N'אחינו כל בית ישראל',
 'https://www.youtube.com/watch?v=9bZkp7q19f0',
 'https://i.ytimg.com/vi/9bZkp7q19f0/maxresdefault.jpg',
 1,
 N'Dm               Am
אחינו כל בית ישראל
Gm               Dm
הנתונים בצרה ובשביה

Bb               C
העומדים בין בים ובין ביבשה
Dm               A
המקום ירחם עליהם

F                C
ויוציאם מצרה לרוחה
Gm               Dm
ומאפלה לאורה',
 18, N'he', 0, 0, 0, GETUTCDATE()),

(16, N'ידיד נפש',
 'https://www.youtube.com/watch?v=L_jWHffIx5E',
 'https://i.ytimg.com/vi/L_jWHffIx5E/maxresdefault.jpg',
 1,
 N'Cm               Gm
ידיד נפש אב הרחמן
Fm               Cm
משוך עבדך אל רצונך

Eb               Bb
ירוץ עבדך כמו איל
Fm               G
ישתחוה מול הדרך',
 16, N'he', 0, 0, 0, GETUTCDATE()),

(17, N'הנה מה טוב',
 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
 'https://i.ytimg.com/vi/fJ9rUzIMcZQ/maxresdefault.jpg',
 1,
 N'G                D
הנה מה טוב ומה נעים
Em               C
שבת אחים גם יחד

G                D
כטל חרמון שיורד
Am               D
על הררי ציון',
 8, N'he', 0, 0, 0, GETUTCDATE());

SET IDENTITY_INSERT Songs OFF;

-- Link all 10 songs to artist מוטי שטינמיץ (ArtistId = 2)
SET IDENTITY_INSERT SongArtists ON;

INSERT INTO SongArtists (Id, SongId, ArtistId, [Order], IsTemporary)
VALUES
(1018,  8, 2, 1, 0),
(1019,  9, 2, 1, 0),
(1020, 10, 2, 1, 0),
(1021, 11, 2, 1, 0),
(1022, 12, 2, 1, 0),
(1023, 13, 2, 1, 0),
(1024, 14, 2, 1, 0),
(1025, 15, 2, 1, 0),
(1026, 16, 2, 1, 0),
(1027, 17, 2, 1, 0);

SET IDENTITY_INSERT SongArtists OFF;

PRINT N'נוספו 10 שירים לאמן מוטי שטינמיץ בהצלחה';
