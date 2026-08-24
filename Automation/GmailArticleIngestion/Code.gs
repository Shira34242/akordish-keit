const SOURCE_LABEL = 'כתבות/ממתין לקליטה';
const PROCESSED_LABEL = 'כתבות/נקלט';
const REVIEW_LABEL = 'כתבות/דורש בדיקה';
const ERROR_LABEL = 'כתבות/שגיאת קליטה';
const MAX_THREADS_PER_RUN = 5;
const AUDIO_EXTENSIONS = /\.(mp3|wav|m4a|aac|ogg)$/i;

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
      const audio = attachments.find(function(file) {
        return AUDIO_EXTENSIONS.test(file.getName());
      });

      const payload = {
        sender: message.getFrom(),
        subject: message.getSubject(),
        messageId: message.getId(),
        plainBody: message.getPlainBody()
      };

      if (audio) {
        payload.audioFile = audio;
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
