// popup.js - Settings UI for i18n Editor Extension

let isEnabled = false;

// DOM elements
const rootInput = document.getElementById('root');
const langInput = document.getElementById('lang');
const forceCheckbox = document.getElementById('force');
const saveButton = document.getElementById('save');
const toggleButton = document.getElementById('toggle');
const statusDiv = document.getElementById('status');

// Show status message
function showStatus(message, type = 'info') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 3000);
}

// Load current settings
function loadSettings() {
    chrome.storage.sync.get(['root', 'lang', 'force'], (items) => {
        rootInput.value = items.root || 'src/assets/locales';
        langInput.value = items.lang || 'de';
        forceCheckbox.checked = items.force || false;
    });
}

// Save settings
function saveSettings() {
    const settings = {
        root: rootInput.value.trim(),
        lang: langInput.value.trim(),
        force: forceCheckbox.checked
    };
    
    // Validate settings
    if (!settings.root) {
        showStatus('Please enter a resource bundle root directory', 'error');
        return;
    }
    
    if (!settings.lang) {
        showStatus('Please enter a language code', 'error');
        return;
    }
    
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';
    
    chrome.storage.sync.set(settings, () => {
        if (chrome.runtime.lastError) {
            showStatus(`Error saving settings: ${chrome.runtime.lastError.message}`, 'error');
        } else {
            showStatus('Settings saved successfully!', 'success');
        }
        
        saveButton.disabled = false;
        saveButton.textContent = '💾 Save Settings';
    });
}

// Toggle editor on current tab
function toggleEditor() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
            showStatus('No active tab found', 'error');
            return;
        }
        
        const tab = tabs[0];
        
        // Send message to content script
        chrome.tabs.sendMessage(tab.id, { action: 'toggle', enabled: !isEnabled }, (response) => {
            if (chrome.runtime.lastError) {
                showStatus('Could not communicate with page. Make sure you\'re on a page with i18n content.', 'error');
                return;
            }
            
            isEnabled = !isEnabled;
            updateToggleButton();
            
            if (isEnabled) {
                showStatus('i18n Editor enabled on this page', 'success');
            } else {
                showStatus('i18n Editor disabled on this page', 'info');
            }
        });
    });
}

// Update toggle button appearance
function updateToggleButton() {
    if (isEnabled) {
        toggleButton.textContent = '🛑 Disable Editor';
        toggleButton.className = 'toggle-button disabled';
    } else {
        toggleButton.textContent = '🚀 Enable Editor';
        toggleButton.className = 'toggle-button';
    }
}

// Check if editor is currently enabled on the active tab
function checkEditorStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) return;
        
        const tab = tabs[0];
        
        // Try to get status from content script
        chrome.tabs.sendMessage(tab.id, { action: 'status' }, (response) => {
            if (response && response.enabled !== undefined) {
                isEnabled = response.enabled;
                updateToggleButton();
            }
        });
    });
}

// Event listeners
saveButton.addEventListener('click', saveSettings);
toggleButton.addEventListener('click', toggleEditor);

// Load settings and check status on popup open
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    checkEditorStatus();
});

// Handle Enter key in input fields
rootInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        saveSettings();
    }
});

langInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        saveSettings();
    }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'editor_status') {
        isEnabled = request.enabled;
        updateToggleButton();
    }
});
