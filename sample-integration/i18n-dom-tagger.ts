const MARK_RE = /\[\[i18n\|([^|\]]+)\|([^\]]+)\]\]([\s\S]*?)\[\[\/i18n\]\]/g;

function attachMeta(el: Element, ns: string, key: string, where: "text" | { attr: string }) {
    if (where === "text") {
        const keys = (el.getAttribute("data-i18n-text-keys") || "").split(",").filter(Boolean);
        const nss = (el.getAttribute("data-i18n-text-ns") || "").split(",").filter(Boolean);
        if (!keys.includes(key)) keys.push(key);
        if (!nss.includes(ns)) nss.push(ns);
        el.setAttribute("data-i18n-text-keys", keys.join(","));
        el.setAttribute("data-i18n-text-ns", nss.join(","));
        return;
    }
    const name = where.attr;
    const listAttr = "data-i18n-attr";
    const attrList = (el.getAttribute(listAttr) || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    if (!attrList.includes(name)) attrList.push(name);
    el.setAttribute(listAttr, attrList.join(","));
    el.setAttribute(`data-i18n-${name}-ns`, ns);
    el.setAttribute(`data-i18n-${name}-key`, key);
}

/**
 * Replace markers in attributes in-place. No node structure changes.
 */
export function replaceMarkedAttributes(root: ParentNode = document.body) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    let el: Element | null;
    while ((el = walker.nextNode() as Element | null)) {
        if (!el) break;
        const names = el.getAttributeNames?.() ?? [];
        for (const name of names) {
            if (name.startsWith("data-i18n")) continue;
            const raw = el.getAttribute(name);
            if (!raw || raw.indexOf("[[i18n|") === -1) continue;

            MARK_RE.lastIndex = 0;
            let out = "";
            let i = 0;
            let m: RegExpExecArray | null;
            let changed = false;
            let firstNs: string | undefined, firstKey: string | undefined;

            while ((m = MARK_RE.exec(raw))) {
                const [full, ns, key, value] = m;
                if (m.index > i) out += raw.slice(i, m.index);
                out += value ?? "";
                if (!firstNs) {
                    firstNs = ns;
                    firstKey = key;
                }
                i = m.index + full.length;
                changed = true;
            }
            if (!changed) continue;
            if (i < raw.length) out += raw.slice(i);

            el.setAttribute(name, out);
            attachMeta(el, firstNs || "translation", firstKey || "", { attr: name });
        }
    }
}

/**
 * Replace markers in text nodes in-place. Handles markers that span across elements.
 * Strategy: Remove opening tags [[i18n|ns|key]] and closing tags [[/i18n]] from text nodes,
 * leaving the content in between intact.
 */
export function replaceMarkedTextNodes(root: ParentNode = document.body) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Text | null;

    // First pass: collect all text nodes with markers
    const nodesWithMarkers: Text[] = [];
    while ((node = walker.nextNode() as Text | null)) {
        if (!node) continue;
        const text = node.nodeValue ?? "";
        if (text.indexOf("[[i18n|") !== -1 || text.indexOf("[[/i18n]]") !== -1) {
            nodesWithMarkers.push(node);
        }
    }

    // Process nodes with complete markers (opening and closing in same node or adjacent siblings)
    for (const startNode of nodesWithMarkers) {
        if (!startNode.parentElement) continue;
        
        const text = startNode.nodeValue ?? "";
        if (text.indexOf("[[i18n|") === -1) continue; // Only process nodes with opening markers
        
        // Check if this is a simple case: marker contained in adjacent text siblings
        const cluster: Text[] = [startNode];
        let merged = text;
        
        // Look ahead through adjacent text siblings
        let nxt = startNode.nextSibling;
        while (nxt && nxt.nodeType === Node.TEXT_NODE) {
            cluster.push(nxt as Text);
            merged += (nxt as Text).nodeValue ?? "";
            nxt = nxt.nextSibling;
        }
        
        // Try to process as adjacent siblings first
        MARK_RE.lastIndex = 0;
        const hasCompleteMarker = MARK_RE.test(merged);
        
        if (hasCompleteMarker) {
            // Standard case: markers in adjacent text siblings
            MARK_RE.lastIndex = 0;
            let out = "";
            let i = 0;
            let m: RegExpExecArray | null;
            let changed = false;
            const metas: Array<{ ns: string; key: string }> = [];

            while ((m = MARK_RE.exec(merged))) {
                const [full, ns, key, value] = m;
                if (m.index > i) out += merged.slice(i, m.index);
                out += value ?? "";
                metas.push({ ns, key });
                i = m.index + full.length;
                changed = true;
            }
            
            if (changed) {
                if (i < merged.length) out += merged.slice(i);
                
                // Write back to first node, clear rest
                cluster[0].nodeValue = out;
                for (let k = 1; k < cluster.length; k++) {
                    cluster[k].nodeValue = "";
                }
                
                // Attach metadata
                for (const { ns, key } of metas) {
                    attachMeta(startNode.parentElement, ns, key, "text");
                }
            }
        }
    }
    
    // Second pass: handle any remaining marker fragments (opening/closing tags split across elements)
    // Just remove the marker syntax itself, leaving content intact
    const walker2 = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while ((node = walker2.nextNode() as Text | null)) {
        if (!node || !node.parentElement) continue;
        let text = node.nodeValue ?? "";
        if (text.indexOf("[[i18n|") === -1 && text.indexOf("[[/i18n]]") === -1) continue;
        
        // Remove any remaining opening markers: [[i18n|ns|key]]
        const beforeOpen = text;
        text = text.replace(/\[\[i18n\|[^|\]]+\|[^\]]+\]\]/g, '');
        
        // Remove any remaining closing markers: [[/i18n]]
        text = text.replace(/\[\[\/i18n\]\]/g, '');
        
        if (text !== beforeOpen) {
            node.nodeValue = text;
            // Try to extract metadata from removed markers
            const openMatches = beforeOpen.matchAll(/\[\[i18n\|([^|\]]+)\|([^\]]+)\]\]/g);
            for (const match of openMatches) {
                const [, ns, key] = match;
                attachMeta(node.parentElement, ns, key, "text");
            }
        }
    }

    // Process attributes too
    replaceMarkedAttributes(root);
}

/**
 * Activate once after your app mounts.
 * Simple, robust: we debounce to the next macrotask to avoid running during React commits.
 */
export function installI18nDomTagger(root: ParentNode = document.body) {
    if (process.env.NODE_ENV !== "development") return;

    let scheduled = false;
    const schedule = () => {
        if (scheduled) return;
        scheduled = true;
        setTimeout(() => {
            try {
                replaceMarkedTextNodes(root);
            } finally {
                scheduled = false;
            }
        }, 0);
    };

    // Initial pass (after current work)
    schedule();

    const mo = new MutationObserver((_muts) => {
        // Do not mutate synchronously inside observer; just schedule one pass.
        schedule();
    });

    mo.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
    });

    return () => mo.disconnect();
}
