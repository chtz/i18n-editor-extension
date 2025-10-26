/* i18n-debug.js — click→reveal i18next keys (namespace-aware) + inline edit
   Chrome Extension Content Script Version
   
   Console API:
     starti18ndebug();   // enable
     stopi18ndebug();    // disable

   Behavior:
     • Click a translated text → finds exact matches across all namespaces
     • Replaces the clicked text with an input for inline editing.
     • On Enter/Tab → sends update to background script for file modification
     • On Escape → cancels editing
*/

(() => {
    if (window.starti18ndebug && window.stopi18ndebug) return;

    // ---------- helpers ----------
    const NORM = (s) =>
        String(s ?? "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();

    function flatten(obj, prefix = "", out = {}) {
        if (!obj || typeof obj !== "object") return out;
        for (const [k, v] of Object.entries(obj)) {
            const key = prefix ? `${prefix}.${k}` : k;
            if (v && typeof v === "object") flatten(v, key, out);
            else out[key] = v;
        }
        return out;
    }

    function cssPath(el) {
        if (!(el instanceof Element)) return "";
        const parts = [];
        while (el && el.nodeType === 1 && el !== document.body) {
            let p = el.nodeName.toLowerCase();
            if (el.id) {
                p += `#${el.id}`;
                parts.unshift(p);
                break;
            }
            if (typeof el.className === "string" && el.className) {
                const cls = el.className.trim().split(/\s+/).slice(0, 3).join(".");
                if (cls) p += `.${cls}`;
            }
            const sibs = Array.from(el.parentNode?.children || []);
            const same = sibs.filter((n) => n.nodeName === el.nodeName);
            if (same.length > 1) p += `:nth-of-type(${same.indexOf(el) + 1})`;
            parts.unshift(p);
            el = el.parentElement;
        }
        return parts.join(" > ");
    }

    async function ensureBundles(i18n, _lang, namespaces) {
        try {
            await i18n.loadNamespaces(namespaces);
        } catch {}
    }

    function getBundle(i18n, lang, ns) {
        let bundle = i18n.store?.data?.[lang]?.[ns];
        if (!bundle && typeof i18n.getResourceBundle === "function") {
            try {
                bundle = i18n.getResourceBundle(lang, ns);
            } catch {}
        }
        return bundle || {};
    }

    function buildIndex(i18n, lang, namespaces) {
        const index = [];
        for (const ns of namespaces) {
            const flat = flatten(getBundle(i18n, lang, ns));
            index.push({ ns, flat, keys: Object.keys(flat) });
        }
        return index;
    }

    function rankByNs(list, defaultNS, fallbackNS) {
        return list.slice().sort((a, b) => {
            const score = (c) => (c.ns === defaultNS ? 2 : c.ns === fallbackNS ? 1 : 0);
            return score(b) - score(a);
        });
    }

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

    // Create an inline editor for the clicked element
    function makeInlineEditor(targetEl, ns, key, oldText, allExact) {
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
        input.style.border = "1px solid #ccc";
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

            // Get current language from i18next
            const i18n = window.i18next || window.i18n;
            const currentLang = i18n?.resolvedLanguage || i18n?.language || null;

            // EVERY exact match gets the same {new} value
            const all = (allExact && allExact.length ? allExact : [{ ns, key }]).map((c) => ({
                key: c.key,
                ns: c.ns,
                old: oldText,
                new: newText,
            }));

            // Send to background script via bridge
            try {
                const response = await new Promise((resolve) => {
                    // Send to bridge script with current language
                    window.postMessage({
                        type: 'i18n-editor-update',
                        payload: all,
                        language: currentLang  // Include current language
                    }, '*');
                    
                    // Listen for response
                    const listener = (event) => {
                        if (event.data.type === 'i18n-editor-update-response') {
                            window.removeEventListener('message', listener);
                            resolve(event.data.response);
                        }
                    };
                    window.addEventListener('message', listener);
                    
                    // Timeout after 10 seconds
                    setTimeout(() => {
                        window.removeEventListener('message', listener);
                        resolve({ success: false, error: 'Timeout waiting for response' });
                    }, 10000);
                });

                if (response && response.success) {
                    console.log("[i18n-debug] ✅ File updated successfully");
                    showNotification(`Updated ${all.length} translation${all.length > 1 ? 's' : ''}`, 'success');
                    
                    // Replace editor with the new text
                    targetEl.innerHTML = "";
                    targetEl.textContent = newText;
                } else {
                    console.error("[i18n-debug] ❌ File update failed:", response?.error);
                    showNotification(`Update failed: ${response?.error || 'Unknown error'}`, 'error');
                }
            } catch (error) {
                console.error("[i18n-debug] ❌ Communication error:", error);
                showNotification(`Communication error: ${error.message}`, 'error');
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

        // With "world": "MAIN" in manifest.json, this script runs in the page context
        // so window.i18next should be directly accessible
        const i18n = window.i18next || window.i18n;
        if (!i18n) {
            console.warn(
                "[i18n-debug] window.i18next not found. Expose your instance in i18n.ts: window.i18next = i18n;",
            );
            console.warn(
                "[i18n-debug] Debug info - window keys with 'i18n':",
                Object.keys(window).filter(key => key.toLowerCase().includes('i18n'))
            );
            return;
        }

        const raw = e.target;
        const target = raw.nodeType === Node.TEXT_NODE ? raw.parentNode : raw;

        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const text =
            raw.nodeType === Node.TEXT_NODE ? raw.nodeValue || "" : target.innerText || target.textContent || "";
        const tN = NORM(text);
        if (!tN) return;

        const lang = i18n.resolvedLanguage || i18n.language || "en";
        const namespaces =
            Array.isArray(i18n.options?.ns) && i18n.options.ns.length ? i18n.options.ns : ["translation"];
        const defaultNS = i18n.options?.defaultNS || namespaces[0] || "translation";
        const fallbackNS = Array.isArray(i18n.options?.fallbackNS)
            ? i18n.options.fallbackNS[0]
            : i18n.options?.fallbackNS || "";

        await ensureBundles(i18n, lang, namespaces);
        const index = buildIndex(i18n, lang, namespaces);

        const exact = [];
        const loose = [];

        // Reverse match
        for (const { ns, flat, keys } of index) {
            for (const k of keys) {
                const v = flat[k];
                if (typeof v !== "string") continue;
                const vN = NORM(v);
                if (!vN) continue;
                if (vN === tN) exact.push({ ns, key: k });
                else if (vN.includes(tN) || tN.includes(vN)) loose.push({ ns, key: k });
            }
        }

        // Verify with i18n.t to handle interpolation/plurals
        const verify = (arr) => {
            const ok = [];
            for (const c of arr) {
                try {
                    const rendered = i18n.t(c.key, { ns: c.ns });
                    if (NORM(rendered) === tN) ok.push(c);
                } catch {}
            }
            return ok;
        };

        const exactVerified = verify(exact);
        const looseVerified = verify(loose.slice(0, 100));

        const bestExact = rankByNs(exactVerified.length ? exactVerified : exact, defaultNS, fallbackNS);
        const bestLoose = rankByNs(looseVerified.length ? looseVerified : loose, defaultNS, fallbackNS);

        // highlight briefly
        if (target && target.style) {
            target.style.outline = "2px solid red";
            setTimeout(() => (target.style.outline = ""), 500);
        }

        console.clear();
        console.group("[i18n-debug] lookup + edit");
        console.log("Element:", target);
        console.log("CSS path:", cssPath(target));
        console.log("Language:", lang);
        console.log("Namespaces:", namespaces.join(", "));
        console.log("Text:", JSON.stringify(text));

        if (bestExact.length) {
            console.log(
                "✅ Exact:",
                bestExact.map((c) => `${c.ns}:${c.key}`),
            );

            // Open inline editor and pass the full exact list for commit-time uniform {new}
            const top = bestExact[0];
            makeInlineEditor(target, top.ns, top.key, text, bestExact);
        } else {
            console.log("❌ No exact match.");
            if (bestLoose.length) {
                console.log(
                    "🤏 Loose:",
                    bestLoose.map((c) => `${c.ns}:${c.key}`),
                );
            }
        }

        if (!bestExact.length && !bestLoose.length) {
            console.log("No candidates found in current bundles.");
        }
        console.groupEnd();
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
