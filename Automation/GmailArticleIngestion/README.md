# Gmail article ingestion

The automation asks the authenticated backend for the approved producer list
and automatically labels new Gmail threads from those senders with
`כתבות/ממתין לקליטה`. It then sends the latest message body, article document
text and the preferred audio file to the backend. A producer may supply these
as email attachments or through a different public Google Drive folder link in
every email. For Drive folders, the automation prefers a Google Doc whose name
contains `קומוניקט` and an MP3 audio file; images and video files are ignored.

## Backend authentication

The endpoint validates the short-lived Google OAuth token sent by Apps Script
and accepts only the configured Google account. No shared secret is stored in
Git or in the hosting environment.

Producer mappings are stored under `EmailArticleIngestion:Producers`. Each
producer has an independent parser and all current mappings use the `חדשות`
category:

- `pr@irpr.co.il`: article content in the email body (`irpr-v1`).
- `tomercohenpr@gmail.com`: article content in an attached Word file
  (`tomer-cohen-v1`).
- `controly.a.p@gmail.com`: article document and audio in a linked Drive
  folder (`control-drive-v1`).
- `mkgy5778@gmail.com`: prefer an attached Word article when present,
  otherwise extract the article after the personal introduction in the email
  body (`mendy-kornet-v1`).
- `info@kobis.co.il`: extract the title, article, credits and YouTube link only
  from the attached Word file; use the attached audio file and ignore the email
  body (`kobis-attachments-v1`).

## Google Apps Script configuration

1. Create a standalone Apps Script project at script.google.com, paste
   `Code.gs` into it and use the supplied `appsscript.json` manifest.
2. Under Project Settings > Script Properties add:
   - `API_URL`: `https://api.akordishkayt.com/api/email-article-ingestion`
3. Run `installFiveMinuteTrigger` once and approve the requested Gmail and
   external-request permissions.
4. Run `processIncomingArticles` once after deployment. This initializes the
   discovery cursor without importing historical mail.
5. Send or forward one new test email from an approved producer and run
   `processIncomingArticles` manually before relying on the recurring trigger.

No Gmail filter update is required when a producer is added. Add the producer
to `EmailArticleIngestion:Producers`, deploy the backend and the next scheduled
run will fetch the updated sender list automatically. A sender that should
remain available only for manual tests can set `AutoDiscover` to `false`.

Successful drafts move to `כתבות/נקלט`. Drafts with missing fields move to
`כתבות/דורש בדיקה`. Transport or server failures remain in the source label and
also receive `כתבות/שגיאת קליטה`, so they can be retried safely.
