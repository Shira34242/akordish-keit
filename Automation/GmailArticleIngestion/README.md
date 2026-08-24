# Gmail article ingestion

The automation reads only Gmail threads carrying the `כתבות/ממתין לקליטה`
label. It sends the latest message body, article document text and the preferred
audio file to the backend. A producer may supply these as email attachments or
through a different public Google Drive folder link in every email. For Drive
folders, the automation prefers a Google Doc whose name contains `קומוניקט` and
an MP3 audio file; images and video files are ignored.

## Backend authentication

The endpoint validates the short-lived Google OAuth token sent by Apps Script
and accepts only the configured Google account. No shared secret is stored in
Git or in the hosting environment.

Producer mappings are stored under `EmailArticleIngestion:Producers`. The first
mapping is `pr@irpr.co.il` using the `חדשות` category and the `irpr-v1` parser.

## Google Apps Script configuration

1. Create a standalone Apps Script project at script.google.com, paste
   `Code.gs` into it and use the supplied `appsscript.json` manifest.
2. Under Project Settings > Script Properties add:
   - `API_URL`: `https://api.akordishkayt.com/api/email-article-ingestion`
3. Run `installFiveMinuteTrigger` once and approve the requested Gmail and
   external-request permissions.
4. In Gmail, create a filter for the approved sender and apply the
   `כתבות/ממתין לקליטה` label.
5. Apply that label to one test email and run `processIncomingArticles`
   manually before enabling the recurring trigger in production.

Successful drafts move to `כתבות/נקלט`. Drafts with missing fields move to
`כתבות/דורש בדיקה`. Transport or server failures remain in the source label and
also receive `כתבות/שגיאת קליטה`, so they can be retried safely.
