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
 * Replace markers in text nodes in-place. We never add/remove nodes.
 * If a marker spans multiple adjacent text nodes, we:
 *  - merge their strings virtually,
 *  - perform replacements on the merged string,
 *  - write the full result back to the FIRST text node,
 *  - set the remaining sibling text nodes in the cluster to "".
 */
export function replaceMarkedTextNodes(root: ParentNode = document.body) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node: Text | null;

    while ((node = walker.nextNode() as Text | null)) {
        if (!node || !node.parentElement) continue;

        // Build a cluster of contiguous text siblings (do not remove them)
        const cluster: Text[] = [node];
        let merged = node.nodeValue ?? "";

        // Only proceed if this node or a neighbor might contain our marker
        let needsCheck = merged.indexOf("[[i18n|") !== -1;

        // Lookahead: include following text siblings
        let nxt = node.nextSibling;
        while (nxt && nxt.nodeType === Node.TEXT_NODE) {
            cluster.push(nxt as Text);
            const val = (nxt as Text).nodeValue ?? "";
            merged += val;
            if (val.indexOf("[[i18n|") !== -1) needsCheck = true;
            nxt = nxt.nextSibling;
        }
        if (!needsCheck) continue;

        // Replace markers in the merged string
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
        if (!changed) continue;
        if (i < merged.length) out += merged.slice(i);

        // Write back without changing the node list
        cluster[0].nodeValue = out;
        for (let k = 1; k < cluster.length; k++) {
            cluster[k].nodeValue = ""; // keep nodes, just clear text
        }

        // Attach metadata to the parent element (aggregated, comma-separated)
        const el = node.parentElement;
        for (const { ns, key } of metas) attachMeta(el, ns, key, "text");
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
