/* i18n-debug.js — Simple click-to-edit for i18next translations
   Chrome Extension Content Script Version
   
   Console API:
     starti18ndebug();   // enable
     stopi18ndebug();    // disable

   Behavior:
     • Click a translated text with data-i18n-text-keys attribute
     • Edit inline
     • On Enter/Tab → updates JSON file
     • On Escape → cancels
*/

(() => {
    if (window.starti18ndebug && window.stopi18ndebug) return;

    // ---------- helpers ----------
    // Show notification in page
    function showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 4px;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        if (type === 'success') {
            notification.style.backgroundColor = '#4CAF50';
        } else if (type === 'error') {
            notification.style.backgroundColor = '#f44336';
        } else {
            notification.style.backgroundColor = '#2196F3';
        }
        
        notification.textContent = message;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    // Create a floating overlay editor (for form elements and attributes)
    function makeFloatingEditor(targetEl, ns, key, oldText) {
        // Create overlay
        const overlay = document.createElement('div');
        overlay.setAttribute('data-i18n-modal', 'true'); // Mark as modal for event filtering
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 999999;
        `;
        
        // Create editor container
        const container = document.createElement('div');
        container.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            min-width: 400px;
            max-width: 600px;
        `;
        
        // Create label
        const label = document.createElement('div');
        label.style.cssText = `
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            color: #666;
            margin-bottom: 8px;
            font-weight: 500;
        `;
        label.textContent = `${ns}:${key}`;
        
        // Create input
        const input = document.createElement('input');
        input.type = 'text';
        input.value = oldText;
        input.dataset.i18nEditor = '1';
        input.dataset.i18nKey = key;
        input.dataset.i18nNs = ns;
        input.dataset.i18nOld = oldText;
        input.style.cssText = `
            width: 100%;
            padding: 10px;
            border: 2px solid #2196F3;
            border-radius: 4px;
            font-family: monospace;
            font-size: 14px;
            box-sizing: border-box;
        `;
        
        // Create hint text
        const hint = document.createElement('div');
        hint.style.cssText = `
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            color: #999;
            margin-top: 8px;
        `;
        hint.textContent = 'Press Enter to save, Escape to cancel';
        
        container.appendChild(label);
        container.appendChild(input);
        container.appendChild(hint);
        overlay.appendChild(container);
        document.body.appendChild(overlay);
        
        input.focus();
        input.select();
        
        async function commit() {
            const newText = input.value;
            
            const payload = [{
                key: key,
                ns: ns,
                old: oldText,
                new: newText,
            }];
            
            try {
                const response = await new Promise((resolve) => {
                    window.postMessage({
                        type: 'i18n-editor-update',
                        payload: payload
                    }, '*');
                    
                    const listener = (event) => {
                        if (event.data.type === 'i18n-editor-update-response') {
                            window.removeEventListener('message', listener);
                            resolve(event.data.response);
                        }
                    };
                    window.addEventListener('message', listener);
                    
                    setTimeout(() => {
                        window.removeEventListener('message', listener);
                        resolve({ success: false, error: 'Timeout waiting for response' });
                    }, 10000);
                });
                
                if (response && response.success) {
                    console.log(`[i18n-debug] ✅ Updated ${ns}:${key}`);
                    showNotification(`Updated: ${key}`, 'success');
                    document.body.removeChild(overlay);
                } else {
                    console.error("[i18n-debug] ❌ Update failed:", response?.error);
                    showNotification(`Update failed: ${response?.error || 'Unknown error'}`, 'error');
                    document.body.removeChild(overlay);
                }
            } catch (error) {
                console.error("[i18n-debug] ❌ Error:", error);
                showNotification(`Error: ${error.message}`, 'error');
                document.body.removeChild(overlay);
            }
        }
        
        function cancel() {
            if (overlay.parentNode) {
                document.body.removeChild(overlay);
            }
        }
        
        input.addEventListener('keydown', (ev) => {
            if (ev.key === 'Enter') {
                ev.preventDefault();
                commit();
            } else if (ev.key === 'Escape') {
                ev.preventDefault();
                cancel();
            }
        });
        
        // Click overlay to cancel
        overlay.addEventListener('click', (ev) => {
            if (ev.target === overlay) {
                cancel();
            }
        });
    }

    // Always use floating modal editor - simple and avoids all DOM/event conflicts
    function makeEditor(targetEl, ns, key, oldText) {
        return makeFloatingEditor(targetEl, ns, key, oldText);
    }

    // ---------- main click handler ----------
    async function handler(e) {
        // Always block the click from doing anything
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const raw = e.target;
        const target = raw.nodeType === Node.TEXT_NODE ? raw.parentNode : raw;

        // Pattern 1: Text content (data-i18n-text-keys, data-i18n-text-ns)
        const textKeysRaw = target.dataset?.i18nTextKeys;
        const textNsRaw = target.dataset?.i18nTextNs;
        
        if (textKeysRaw && textNsRaw) {
            // Handle comma-separated values (i18n-dom-tagger can generate multiple keys)
            const keys = textKeysRaw.split(',').map(k => k.trim()).filter(Boolean);
            const namespaces = textNsRaw.split(',').map(n => n.trim()).filter(Boolean);
            
            // Use the first key/namespace pair (most common case)
            const textKey = keys[0];
            const textNs = namespaces[0];
            
            if (!textKey || !textNs) {
                console.warn("[i18n-debug] Invalid i18n attributes (empty after parsing)");
                showNotification("Element not editable: invalid i18n attributes", 'error');
                return;
            }
            
            // Use the current text content as the template
            const text = target.textContent || target.innerText || "";
            
            console.clear();
            console.log(`[i18n-debug] Editing ${textNs}:${textKey}`);
            if (keys.length > 1) {
                console.log(`[i18n-debug] Note: Element has ${keys.length} keys, editing the first one`);
            }
            console.log("Current value:", JSON.stringify(text));
            
            // Highlight briefly
            if (target && target.style) {
                target.style.outline = "2px solid #4CAF50";
                setTimeout(() => (target.style.outline = ""), 500);
            }
            
            // Open modal editor
            makeEditor(target, textNs, textKey, text);
            return;
        }
        
        // Pattern 2: Attribute content (data-i18n-attr, data-i18n-{attr}-ns, data-i18n-{attr}-key)
        const attrListRaw = target.dataset?.i18nAttr;
        
        if (attrListRaw) {
            // Handle comma-separated attribute names (i18n-dom-tagger can tag multiple attributes)
            const attrNames = attrListRaw.split(',').map(a => a.trim()).filter(Boolean);
            
            // Use the first attribute (most common case)
            const attrName = attrNames[0];
            
            if (!attrName) {
                console.warn("[i18n-debug] Invalid data-i18n-attr (empty after parsing)");
                showNotification("Element not editable: invalid i18n-attr", 'error');
                return;
            }
            
            const attrNsKey = `i18n${attrName.charAt(0).toUpperCase() + attrName.slice(1)}Ns`;
            const attrKeyKey = `i18n${attrName.charAt(0).toUpperCase() + attrName.slice(1)}Key`;
            
            const ns = target.dataset[attrNsKey];
            const key = target.dataset[attrKeyKey];
            
            if (!ns || !key) {
                console.warn(`[i18n-debug] Element missing required attributes: data-i18n-${attrName}-ns and data-i18n-${attrName}-key`);
                showNotification(`Element not editable: missing i18n-${attrName} attributes`, 'error');
                return;
            }
            
            // Use the current attribute value
            const currentValue = target.getAttribute(attrName) || "";
            
            console.clear();
            console.log(`[i18n-debug] Editing ${ns}:${key} (attribute: ${attrName})`);
            if (attrNames.length > 1) {
                console.log(`[i18n-debug] Note: Element has ${attrNames.length} translated attributes, editing the first one`);
            }
            console.log("Current value:", JSON.stringify(currentValue));
            
            // Highlight briefly
            if (target && target.style) {
                target.style.outline = "2px solid #2196F3";
                setTimeout(() => (target.style.outline = ""), 500);
            }
            
            // Open modal editor
            makeEditor(target, ns, key, currentValue);
            return;
        }
        
        // No supported attributes found
        console.warn("[i18n-debug] Element missing required i18n attributes");
        showNotification("Element not editable: missing i18n attributes", 'error');
    }

    // ---------- public controls ----------
    const capture = true;
    
    // Block all user interactions with the page (except modal)
    function blockInteraction(e) {
        const target = e.target;
        
        // Allow interaction with modal overlay elements only
        if (target.closest && target.closest('[data-i18n-modal]')) {
            return;
        }
        
        // Block everything else
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    }
    
    window.starti18ndebug = function starti18ndebug() {
        if (window.__i18nDebugActive) {
            console.info("[i18n-debug] already running.");
            return;
        }
        window.__i18nDebugActive = true;
        window.__i18nNSInspector = handler;
        
        // Capture click to intercept before any app handlers
        document.addEventListener("click", handler, capture);
        
        // Block all other interactions (click is handled separately by handler)
        const blockEvents = ['mousedown', 'mouseup', 'dblclick', 'contextmenu', 
                             'keydown', 'keypress', 'keyup', 
                             'touchstart', 'touchend', 'touchmove',
                             'submit', 'change', 'input', 'focus', 'blur',
                             'pointerdown', 'pointerup', 'pointermove'];
        
        blockEvents.forEach(eventType => {
            document.addEventListener(eventType, blockInteraction, capture);
        });
        
        // Store event types for cleanup
        window.__i18nBlockedEvents = blockEvents;
        
        // Add visual indicator that page is in edit mode
        document.body.style.cursor = 'crosshair';
        
        console.info(
            "[i18n-debug] enabled. Click translated text to reveal keys and edit. " +
                "Enter/Tab updates files automatically.",
        );
        showNotification("i18n Editor enabled - click text to edit", 'info');
        
        // Persist enabled state
        window.postMessage({
            type: 'i18n-editor-persist-state',
            enabled: true
        }, '*');
    };

    window.stopi18ndebug = function stopi18ndebug() {
        if (!window.__i18nDebugActive) {
            console.info("[i18n-debug] not running.");
            return;
        }
        
        // Remove click handler
        document.removeEventListener("click", window.__i18nNSInspector, capture);
        
        // Remove all blocked event listeners
        if (window.__i18nBlockedEvents) {
            window.__i18nBlockedEvents.forEach(eventType => {
                document.removeEventListener(eventType, blockInteraction, capture);
            });
            delete window.__i18nBlockedEvents;
        }
        
        // Restore cursor
        document.body.style.cursor = '';
        
        window.__i18nNSInspector = undefined;
        window.__i18nDebugActive = false;
        console.info("[i18n-debug] disabled.");
        showNotification("i18n Editor disabled", 'info');
        
        // Persist disabled state
        window.postMessage({
            type: 'i18n-editor-persist-state',
            enabled: false
        }, '*');
    };
    
    // Auto-restore state on page load
    function restoreEditorState() {
        window.postMessage({
            type: 'i18n-editor-restore-state'
        }, '*');
    }

    // Listen for messages from popup via window messages
    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        
        if (event.data.type === 'i18n-editor-toggle') {
            if (event.data.enabled) {
                starti18ndebug();
            } else {
                stopi18ndebug();
            }
            // Send response back
            window.postMessage({
                type: 'i18n-editor-response',
                success: true
            }, '*');
        }
        
        if (event.data.type === 'i18n-editor-status-request') {
            // Send current status
            window.postMessage({
                type: 'i18n-editor-status-response',
                enabled: !!window.__i18nDebugActive
            }, '*');
        }
        
        if (event.data.type === 'i18n-editor-state-restored' && event.data.enabled) {
            // Auto-enable if it was previously enabled
            starti18ndebug();
        }
    });
    
    // Restore state on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', restoreEditorState);
    } else {
        restoreEditorState();
    }

})();
