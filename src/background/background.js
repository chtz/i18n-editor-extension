// Background Service Worker for i18n Editor Extension

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'UPDATE_TRANSLATION') {
    handleTranslationUpdate(request, sendResponse);
    return true; // keep message channel open
  }

  if (request.type === 'GET_CONFIG') {
    chrome.storage.sync.get(['root', 'lang', 'force'], (config) => {
      sendResponse(config);
    });
    return true;
  }

  if (request.type === 'SET_CONFIG') {
    chrome.storage.sync.set(request.config, () => {
      sendResponse({ success: true });
    });
    return true;
  }
  
  if (request.type === 'GET_TEMPLATE') {
    handleGetTemplate(request, sendResponse);
    return true;
  }
});

async function handleTranslationUpdate(request, sendResponse) {
  try {
    const config = await new Promise((resolve) =>
      chrome.storage.sync.get(['root', 'lang', 'force'], resolve)
    );

    // Always use the configured language from extension settings
    const targetLang = config.lang || 'de';

    const message = {
      root: config.root || 'src/assets/locales',
      lang: targetLang,
      force: !!config.force,
      payload: request.payload,
    };

    chrome.runtime.sendNativeMessage('com.i18ntexteditor.host', message, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Native messaging error:', chrome.runtime.lastError.message);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
        return;
      }

      if (!response) {
        console.error('No response received from native host');
        sendResponse({ success: false, error: 'No response from native host' });
        return;
      }

      sendResponse(response);
    });
  } catch (err) {
    console.error('Error handling translation update:', err);
    sendResponse({ success: false, error: `Communication error: ${err.message}` });
  }
}

async function handleGetTemplate(request, sendResponse) {
  try {
    const config = await new Promise((resolve) =>
      chrome.storage.sync.get(['root', 'lang'], resolve)
    );

    const message = {
      root: config.root || 'src/assets/locales',
      lang: config.lang || 'de',
      key: request.key,
      action: 'get_template',
    };

    chrome.runtime.sendNativeMessage('com.i18ntexteditor.host', message, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Native messaging error:', chrome.runtime.lastError.message);
        sendResponse({ template: null });
        return;
      }

      sendResponse({ template: response?.template || null });
    });
  } catch (err) {
    console.error('Error getting template:', err);
    sendResponse({ template: null });
  }
}

// Initialize default settings on install
chrome.runtime.onInstalled.addListener((details) => {
  chrome.storage.sync.get(['root', 'lang', 'force'], (config) => {
    if (!config.root) {
      chrome.storage.sync.set({
        root: 'src/assets/locales',
        lang: 'de',
        force: false,
      });
    }
  });
});
  