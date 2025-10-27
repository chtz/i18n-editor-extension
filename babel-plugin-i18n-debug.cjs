// babel-plugin-i18n-debug.cjs
// Babel plugin that wraps t() calls with data attributes for i18n debugging
// Usage: Add to your Vite/webpack config with localesPath and defaultLang options

const fs = require('fs');
const path = require('path');

module.exports = function (babel) {
    const { types: t } = babel;

    // Cache for loaded translation files
    const translationCache = {};

    // Function to load translation file
    function getTranslation(lang, namespace, key, localesPath) {
        const cacheKey = `${lang}:${namespace}`;
        
        if (!translationCache[cacheKey]) {
            try {
                // Construct path to JSON file
                const jsonPath = path.resolve(localesPath, lang, `${namespace}.json`);
                
                if (fs.existsSync(jsonPath)) {
                    const content = fs.readFileSync(jsonPath, 'utf8');
                    translationCache[cacheKey] = JSON.parse(content);
                } else {
                    translationCache[cacheKey] = {};
                }
            } catch (err) {
                console.warn(`[i18n-debug-plugin] Could not load ${cacheKey}:`, err.message);
                translationCache[cacheKey] = {};
            }
        }

        // Navigate nested keys (e.g., "page.title.main")
        const keys = key.split('.');
        let value = translationCache[cacheKey];
        for (const k of keys) {
            if (value && typeof value === 'object') {
                value = value[k];
            } else {
                break;
            }
        }

        return typeof value === 'string' ? value : '';
    }

    return {
        name: "i18n-debug-wrapper",
        visitor: {
            CallExpression(path, state) {
                // Only in development
                if (process.env.NODE_ENV !== "development") return;

                // Skip if this node was created by us
                if (path.node.__i18nWrapped) return;

                const callee = path.node.callee;

                // Match: t("key") or t('key')
                if (callee.name === "t" && path.node.arguments.length > 0) {
                    const firstArg = path.node.arguments[0];

                    // Only transform string literal keys
                    if (t.isStringLiteral(firstArg)) {
                        const key = firstArg.value;

                        // Get namespace from options
                        let namespace = "translation";
                        if (path.node.arguments[1] && t.isObjectExpression(path.node.arguments[1])) {
                            const nsProperty = path.node.arguments[1].properties.find(
                                (prop) =>
                                    t.isIdentifier(prop.key, { name: "ns" }) ||
                                    (t.isStringLiteral(prop.key) && prop.key.value === "ns"),
                            );
                            if (nsProperty && t.isStringLiteral(nsProperty.value)) {
                                namespace = nsProperty.value.value;
                            }
                        }

                        // Get locales path from plugin options or use default
                        const localesPath = state.opts.localesPath || 'src/assets/locales';
                        const defaultLang = state.opts.defaultLang || 'de';

                        // Get the template string from JSON
                        const template = getTranslation(defaultLang, namespace, key, localesPath);

                        // Clone the original call and mark it
                        const originalCall = t.cloneNode(path.node);
                        originalCall.__i18nWrapped = true;

                        // Build attributes array
                        const attributes = [
                            t.jsxAttribute(t.jsxIdentifier("data-i18n-key"), t.stringLiteral(key)),
                            t.jsxAttribute(t.jsxIdentifier("data-i18n-ns"), t.stringLiteral(namespace))
                        ];

                        // Add template attribute if we found the template
                        if (template) {
                            attributes.push(
                                t.jsxAttribute(t.jsxIdentifier("data-i18n-tpl"), t.stringLiteral(template))
                            );
                        }

                        // Transform: t("key")
                        // Into: <span data-i18n-key="key" data-i18n-ns="translation" data-i18n-tpl="...">{t("key")}</span>
                        const wrapper = t.jsxElement(
                            t.jsxOpeningElement(
                                t.jsxIdentifier("span"),
                                attributes,
                                false,
                            ),
                            t.jsxClosingElement(t.jsxIdentifier("span")),
                            [t.jsxExpressionContainer(originalCall)],
                            false,
                        );

                        path.replaceWith(wrapper);
                        path.skip();
                    }
                }
            },
        },
    };
};

