const SOURCE_LABEL = 'כתבות/ממתין לקליטה';
const PROCESSED_LABEL = 'כתבות/נקלט';
const REVIEW_LABEL = 'כתבות/דורש בדיקה';
const ERROR_LABEL = 'כתבות/שגיאת קליטה';
const MAX_THREADS_PER_RUN = 5;
const AUDIO_EXTENSIONS = /\.(mp3|wav|m4a|aac|ogg)$/i;
const WORD_EXTENSIONS = /\.(doc|docx)$/i;
const DRIVE_FOLDER_REGEX = /https?:\/\/drive\.google\.com\/drive\/folders\/([A-Za-z0-9_-]+)/i;

function processIncomingArticles() {
  ensureFiveMinuteTrigger_();

  const properties = PropertiesService.getScriptProperties();
  const apiUrl = requiredProperty_(properties, 'API_URL');

  const sourceLabel = getOrCreateLabel_(SOURCE_LABEL);
  const processedLabel = getOrCreateLabel_(PROCESSED_LABEL);
  const reviewLabel = getOrCreateLabel_(REVIEW_LABEL);
  const errorLabel = getOrCreateLabel_(ERROR_LABEL);
  const threads = sourceLabel.getThreads(0, MAX_THREADS_PER_RUN);

  threads.forEach(function(thread) {
    try {
      const messages = thread.getMessages();
      const message = messages[messages.length - 1];
      const attachments = message.getAttachments({
        includeInlineImages: false,
        includeAttachments: true
      });
      let audio = attachments.find(function(file) {
        return AUDIO_EXTENSIONS.test(file.getName());
      });
      const wordDocument = attachments.find(function(file) {
        return WORD_EXTENSIONS.test(file.getName());
      });
      let documentText = wordDocument
        ? convertWordBlobToText_(wordDocument.copyBlob(), wordDocument.getName())
        : '';

      const folderId = extractDriveFolderId_(message.getPlainBody());
      if (folderId) {
        const folderResources = readDriveFolderResources_(folderId);
        if (!documentText && folderResources.documentText) {
          documentText = folderResources.documentText;
        }
        if (!audio && folderResources.audioFile) {
          audio = folderResources.audioFile;
        }
      }

      const payload = {
        sender: message.getFrom(),
        subject: message.getSubject(),
        messageId: message.getId(),
        plainBody: message.getPlainBody()
      };

      if (audio) {
        payload.audioFile = audio;
      }
      if (documentText) {
        payload.documentText = documentText;
      }

      const response = UrlFetchApp.fetch(apiUrl, {
        method: 'post',
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
        payload: payload,
        muteHttpExceptions: true
      });

      const status = response.getResponseCode();
      const body = parseJson_(response.getContentText());
      if (status < 200 || status >= 300 || !body.success) {
        throw new Error('API returned ' + status + ': ' + response.getContentText());
      }

      sourceLabel.removeFromThread(thread);
      errorLabel.removeFromThread(thread);
      if (body.requiresReview) {
        reviewLabel.addToThread(thread);
      } else {
        processedLabel.addToThread(thread);
      }
    } catch (error) {
      console.error('Email article ingestion failed for thread ' + thread.getId(), error);
      errorLabel.addToThread(thread);
    }
  });
}

function extractDriveFolderId_(plainBody) {
  const match = DRIVE_FOLDER_REGEX.exec(plainBody || '');
  return match ? match[1] : null;
}

function readDriveFolderResources_(folderId) {
  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  const documentCandidates = [];
  const audioCandidates = [];

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName();
    const mimeType = file.getMimeType();

    if (mimeType === MimeType.GOOGLE_DOCS || WORD_EXTENSIONS.test(name)) {
      documentCandidates.push(file);
    }
    if (AUDIO_EXTENSIONS.test(name)) {
      audioCandidates.push(file);
    }
  }

  documentCandidates.sort(function(left, right) {
    return documentPriority_(left) - documentPriority_(right);
  });
  audioCandidates.sort(function(left, right) {
    return audioPriority_(left) - audioPriority_(right);
  });

  let documentText = '';
  if (documentCandidates.length > 0) {
    const documentFile = documentCandidates[0];
    documentText = documentFile.getMimeType() === MimeType.GOOGLE_DOCS
      ? exportGoogleDocAsText_(documentFile.getId())
      : convertWordBlobToText_(documentFile.getBlob(), documentFile.getName());
  }

  let audioFile = null;
  if (audioCandidates.length > 0) {
    const audio = audioCandidates[0];
    audioFile = audio.getBlob().setName(audio.getName());
  }

  return {
    documentText: documentText,
    audioFile: audioFile
  };
}

function documentPriority_(file) {
  const name = file.getName();
  const communicationScore = /קומוניקט/.test(name) ? 0 : 10;
  const googleDocScore = file.getMimeType() === MimeType.GOOGLE_DOCS ? 0 : 1;
  return communicationScore + googleDocScore;
}

function audioPriority_(file) {
  const name = file.getName();
  if (/\.mp3$/i.test(name)) return 0;
  if (/\.m4a$/i.test(name)) return 1;
  if (/\.aac$/i.test(name)) return 2;
  if (/\.ogg$/i.test(name)) return 3;
  return 4;
}

function convertWordBlobToText_(blob, fileName) {
  const converted = Drive.Files.create({
    name: fileName + ' - temporary conversion',
    mimeType: MimeType.GOOGLE_DOCS
  }, blob, { fields: 'id' });

  try {
    return exportGoogleDocAsText_(converted.id);
  } finally {
    Drive.Files.remove(converted.id);
  }
}

function exportGoogleDocAsText_(fileId) {
  const response = UrlFetchApp.fetch(
    'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) +
      '/export?mimeType=' + encodeURIComponent('text/plain'),
    {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true
    }
  );

  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Could not export Drive document: ' + response.getContentText());
  }

  return response.getContentText();
}

function installFiveMinuteTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(function(trigger) {
      return trigger.getHandlerFunction() === 'processIncomingArticles';
    })
    .forEach(function(trigger) {
      ScriptApp.deleteTrigger(trigger);
    });

  ScriptApp.newTrigger('processIncomingArticles')
    .timeBased()
    .everyMinutes(5)
    .create();
}

function ensureFiveMinuteTrigger_() {
  const triggerExists = ScriptApp.getProjectTriggers().some(function(trigger) {
    return trigger.getHandlerFunction() === 'processIncomingArticles';
  });

  if (!triggerExists) {
    ScriptApp.newTrigger('processIncomingArticles')
      .timeBased()
      .everyMinutes(5)
      .create();
  }
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function requiredProperty_(properties, name) {
  const value = properties.getProperty(name);
  if (!value) {
    throw new Error('Missing Script Property: ' + name);
  }
  return value;
}

function parseJson_(value) {
  try {
    return JSON.parse(value);
  } catch (error) {
    return {};
  }
}
