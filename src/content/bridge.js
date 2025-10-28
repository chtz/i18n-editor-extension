// bridge.js - Bridge between page context and extension context
// This runs in the content script context (isolated world)

// Listen for messages from the page context
window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    
    if (event.data.type === 'i18n-editor-update') {
        // Forward to background script (language comes from extension config)
        chrome.runtime.sendMessage({
            type: 'UPDATE_TRANSLATION',
            payload: event.data.payload
        }, (response) => {
            // Send response back to page context
            window.postMessage({
                type: 'i18n-editor-update-response',
                response: response
            }, '*');
        });
    }
    
    if (event.data.type === 'i18n-editor-persist-state') {
        // Store enabled state per tab
        chrome.storage.local.set({
            [`i18n-editor-enabled-${getTabKey()}`]: event.data.enabled
        });
    }
    
    if (event.data.type === 'i18n-editor-restore-state') {
        // Restore enabled state for this tab
        chrome.storage.local.get([`i18n-editor-enabled-${getTabKey()}`], (result) => {
            const enabled = result[`i18n-editor-enabled-${getTabKey()}`] || false;
            window.postMessage({
                type: 'i18n-editor-state-restored',
                enabled: enabled
            }, '*');
        });
    }
});

// Get a unique key for the current tab based on hostname
function getTabKey() {
    return window.location.hostname || 'default';
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'toggle') {
        // Forward to page context
        window.postMessage({
            type: 'i18n-editor-toggle',
            enabled: request.enabled
        }, '*');
        sendResponse({ success: true });
        return false; // Synchronous response
    }
    
    if (request.action === 'status') {
        // Check status in page context
        window.postMessage({
            type: 'i18n-editor-status-request'
        }, '*');
        
        // Listen for response
        const listener = (event) => {
            if (event.data.type === 'i18n-editor-status-response') {
                window.removeEventListener('message', listener);
                sendResponse({ enabled: event.data.enabled });
            }
        };
        window.addEventListener('message', listener);
        
        // Timeout after 1 second
        setTimeout(() => {
            window.removeEventListener('message', listener);
            sendResponse({ enabled: false });
        }, 1000);
        
        return true; // Async response
    }
});
