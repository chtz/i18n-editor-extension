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
    function isEditableInput(el) {
        return el && el.nodeType === 1 && el.tagName === "INPUT" && el.dataset.i18nEditor === "1";
    }

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
                ev.stopPropagation();
                commit();
            } else if (ev.key === 'Escape') {
                ev.preventDefault();
                ev.stopPropagation();
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

    // Create an inline editor for the clicked element
    function makeInlineEditor(targetEl, ns, key, oldText, isAttribute = false) {
        const isFormElement = targetEl.tagName === 'INPUT' || targetEl.tagName === 'TEXTAREA' || targetEl.tagName === 'SELECT';
        
        // For form elements or attributes, create a floating overlay editor
        if (isFormElement || isAttribute) {
            return makeFloatingEditor(targetEl, ns, key, oldText);
        }
        
        // For text content, replace inline
        const widthPx = Math.max(80, targetEl.clientWidth || 0);

        const input = document.createElement("input");
        input.type = "text";
        input.value = oldText;
        input.dataset.i18nEditor = "1";
        input.dataset.i18nKey = key;
        input.dataset.i18nNs = ns;
        input.dataset.i18nOld = oldText;

        input.style.width = widthPx ? widthPx + "px" : "auto";
        input.style.boxSizing = "border-box";
        input.style.font = getComputedStyle(targetEl).font;
        input.style.padding = "2px 6px";
        input.style.margin = "0";
        input.style.border = "2px solid #4CAF50";
        input.style.borderRadius = "4px";
        input.style.background = "white";
        input.style.color = getComputedStyle(targetEl).color;

        const oldHTML = targetEl.innerHTML;
        targetEl.dataset.i18nOldHTML = oldHTML;
        targetEl.innerHTML = "";
        targetEl.appendChild(input);
        input.focus();
        input.select();

        async function commit() {
            const newText = input.value;

            // Single key update
            const payload = [{
                key: key,
                ns: ns,
                old: oldText,
                new: newText,
            }];

            // Send to background script via bridge
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
                    targetEl.innerHTML = "";
                    targetEl.textContent = newText;
                } else {
                    console.error("[i18n-debug] ❌ Update failed:", response?.error);
                    showNotification(`Update failed: ${response?.error || 'Unknown error'}`, 'error');
                }
            } catch (error) {
                console.error("[i18n-debug] ❌ Error:", error);
                showNotification(`Error: ${error.message}`, 'error');
            }
        }

        function cancel() {
            targetEl.innerHTML = targetEl.dataset.i18nOldHTML || oldText;
            delete targetEl.dataset.i18nOldHTML;
        }

        input.addEventListener("keydown", (ev) => {
            if (ev.key === "Enter" || ev.key === "Tab") {
                ev.preventDefault();
                ev.stopPropagation();
                commit();
            } else if (ev.key === "Escape") {
                ev.preventDefault();
                ev.stopPropagation();
                cancel();
            }
        });

        // Optional: blur commits UI text (no file write)
        input.addEventListener("blur", () => {
            if (isEditableInput(input)) {
                input.dataset.i18nEditor = "0";
                const newText = input.value;
                targetEl.innerHTML = "";
                targetEl.textContent = newText;
            }
        });
    }

    // ---------- main click handler ----------
    async function handler(e) {
        if (isEditableInput(e.target)) return;

        const raw = e.target;
        const target = raw.nodeType === Node.TEXT_NODE ? raw.parentNode : raw;

        // For input/textarea/select elements, check if they have i18n attributes
        // If not, let them behave normally
        const isFormElement = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
        
        if (isFormElement) {
            // Only prevent default if element has i18n attributes
            const hasI18nAttrs = target.dataset?.i18nTextKeys || target.dataset?.i18nAttr;
            if (!hasI18nAttrs) {
                return; // Let form element behave normally
            }
        }

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

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
            
            // Open inline editor (not an attribute)
            makeInlineEditor(target, textNs, textKey, text, false);
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
            
            // Open floating editor for attribute
            makeInlineEditor(target, ns, key, currentValue, true);
            return;
        }
        
        // No supported attributes found
        console.warn("[i18n-debug] Element missing required i18n attributes");
        showNotification("Element not editable: missing i18n attributes", 'error');
    }

    // ---------- public controls ----------
    const capture = true;
    window.starti18ndebug = function starti18ndebug() {
        if (window.__i18nDebugActive) {
            console.info("[i18n-debug] already running.");
            return;
        }
        window.__i18nDebugActive = true;
        window.__i18nNSInspector = handler;
        document.addEventListener("click", handler, capture);
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
        document.removeEventListener("click", window.__i18nNSInspector, capture);
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
