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

    // Helper to check if parent context allows JSX wrapping
    function canWrapInJSX(path) {
        // Check if we're already inside JSX
        const parent = path.parent;
        
        // Can wrap if in JSX expression container
        if (t.isJSXExpressionContainer(parent)) return true;
        
        // Can wrap if direct child of JSX element
        if (t.isJSXElement(parent)) return true;
        
        // Can wrap in conditional expressions inside JSX
        if (t.isConditionalExpression(parent) || t.isLogicalExpression(parent)) {
            return canWrapInJSX(path.parentPath);
        }
        
        // Cannot wrap in props, variable declarations, etc.
        return false;
    }
    
    // Helper to create wrapper JSX with attributes
    function createWrapper(originalCall, key, namespace, template) {
        const attributes = [
            t.jsxAttribute(t.jsxIdentifier("data-i18n-key"), t.stringLiteral(key)),
            t.jsxAttribute(t.jsxIdentifier("data-i18n-ns"), t.stringLiteral(namespace))
        ];

        if (template) {
            attributes.push(
                t.jsxAttribute(t.jsxIdentifier("data-i18n-tpl"), t.stringLiteral(template))
            );
        }

        return t.jsxElement(
            t.jsxOpeningElement(
                t.jsxIdentifier("span"),
                attributes,
                false,
            ),
            t.jsxClosingElement(t.jsxIdentifier("span")),
            [t.jsxExpressionContainer(originalCall)],
            false,
        );
    }

    return {
        name: "i18n-debug-wrapper",
        pre() {
            // Initialize stats tracking
            this.i18nStats = {
                total: 0,
                wrapped: 0,
                skipped: 0,
                patterns: {
                    directJSX: 0,
                    jsxAttribute: 0,
                    conditional: 0,
                    variable: 0,
                    dynamicKey: 0,
                    templateLiteral: 0,
                    other: 0
                },
                skippedReasons: []
            };
        },
        post() {
            // Report stats at end of compilation
            if (process.env.I18N_DEBUG === 'true' && this.i18nStats.total > 0) {
                console.log('\n[i18n-debug-plugin] Translation Coverage Report:');
                console.log('━'.repeat(60));
                console.log(`Total t() calls found: ${this.i18nStats.total}`);
                console.log(`  ✅ Wrapped: ${this.i18nStats.wrapped} (${Math.round(this.i18nStats.wrapped/this.i18nStats.total*100)}%)`);
                console.log(`  ⚠️  Skipped: ${this.i18nStats.skipped} (${Math.round(this.i18nStats.skipped/this.i18nStats.total*100)}%)`);
                console.log('\nPattern Breakdown:');
                console.log(`  Direct JSX: ${this.i18nStats.patterns.directJSX}`);
                console.log(`  JSX Attributes: ${this.i18nStats.patterns.jsxAttribute}`);
                console.log(`  Conditionals: ${this.i18nStats.patterns.conditional}`);
                console.log(`  Variables: ${this.i18nStats.patterns.variable}`);
                console.log(`  Dynamic Keys: ${this.i18nStats.patterns.dynamicKey}`);
                console.log(`  Template Literals: ${this.i18nStats.patterns.templateLiteral}`);
                console.log(`  Other: ${this.i18nStats.patterns.other}`);
                
                if (this.i18nStats.skippedReasons.length > 0) {
                    console.log('\n⚠️  Skipped Patterns (first 10):');
                    this.i18nStats.skippedReasons.slice(0, 10).forEach((reason, idx) => {
                        console.log(`  ${idx + 1}. ${reason}`);
                    });
                    if (this.i18nStats.skippedReasons.length > 10) {
                        console.log(`  ... and ${this.i18nStats.skippedReasons.length - 10} more`);
                    }
                }
                console.log('━'.repeat(60));
                console.log('💡 Set I18N_DEBUG=true to see this report\n');
            }
        },
        visitor: {
            CallExpression(path, state) {
                // Only in development
                if (process.env.NODE_ENV !== "development") return;

                // Skip if this node was created by us
                if (path.node.__i18nWrapped) return;

                const callee = path.node.callee;

                // Match: t("key"), t('key'), or destructured t from useTranslation
                const isTFunction = 
                    (t.isIdentifier(callee) && callee.name === "t") ||
                    (t.isMemberExpression(callee) && 
                     t.isIdentifier(callee.property) && 
                     callee.property.name === "t");

                if (isTFunction && path.node.arguments.length > 0) {
                    // Track this t() call
                    state.file.i18nStats = state.file.i18nStats || this.i18nStats;
                    state.file.i18nStats.total++;
                    
                    const firstArg = path.node.arguments[0];
                    
                    // Detect and track dynamic keys
                    if (t.isTemplateLiteral(firstArg)) {
                        state.file.i18nStats.skipped++;
                        state.file.i18nStats.patterns.templateLiteral++;
                        const loc = path.node.loc;
                        state.file.i18nStats.skippedReasons.push(
                            `Template literal: t(\`...\`) at ${state.file.opts.filename}:${loc?.start.line || '?'}`
                        );
                        return;
                    }
                    
                    if (!t.isStringLiteral(firstArg)) {
                        state.file.i18nStats.skipped++;
                        state.file.i18nStats.patterns.dynamicKey++;
                        const loc = path.node.loc;
                        const keyType = firstArg.type;
                        state.file.i18nStats.skippedReasons.push(
                            `Dynamic key (${keyType}): t(variable) at ${state.file.opts.filename}:${loc?.start.line || '?'}`
                        );
                        return;
                    }

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

                        // Detect pattern type for stats
                        const parent = path.parentPath;
                        let patternType = 'other';
                        
                        if (t.isJSXExpressionContainer(path.parent)) {
                            const jsxParent = parent.parentPath;
                            if (t.isJSXAttribute(jsxParent.node)) {
                                patternType = 'jsxAttribute';
                            } else {
                                patternType = 'directJSX';
                            }
                        } else if (t.isConditionalExpression(parent.node) || t.isLogicalExpression(parent.node)) {
                            patternType = 'conditional';
                        } else if (t.isVariableDeclarator(parent.node)) {
                            patternType = 'variable';
                        }

                        // Check if we can wrap in JSX
                        if (canWrapInJSX(path)) {
                            // Transform to JSX wrapper
                            const wrapper = createWrapper(originalCall, key, namespace, template);
                            path.replaceWith(wrapper);
                            path.skip();
                            
                            // Track success
                            state.file.i18nStats.wrapped++;
                            state.file.i18nStats.patterns[patternType]++;
                        } else {
                            // For cases where JSX isn't possible (props, variables, etc.)
                            // Wrap with an object that has both the call and metadata
                            // Then transform the parent to use it properly
                            
                            // Store metadata on the node itself
                            originalCall._i18nKey = key;
                            originalCall._i18nNs = namespace;
                            originalCall._i18nTpl = template;
                            
                            // Replace with marked call
                            path.replaceWith(originalCall);
                            
                            // Try to handle the parent context
                            const parent = path.parentPath;
                            
                            let handled = false;
                            
                            // Case 1: JSX Attribute value like <Button label={t("key")} />
                            if (t.isJSXExpressionContainer(parent.node)) {
                                const jsxParent = parent.parentPath;
                                if (t.isJSXAttribute(jsxParent.node)) {
                                    // Create wrapper element with attributes
                                    const wrapper = createWrapper(
                                        t.cloneNode(originalCall), 
                                        key, 
                                        namespace, 
                                        template
                                    );
                                    parent.replaceWith(t.jsxExpressionContainer(wrapper));
                                    handled = true;
                                    state.file.i18nStats.wrapped++;
                                    state.file.i18nStats.patterns.jsxAttribute++;
                                }
                            }
                            
                            // Case 2: Variable declaration like const title = t("key")
                            else if (t.isVariableDeclarator(parent.node)) {
                                // Create an IIFE that returns wrapped JSX
                                const wrapper = createWrapper(
                                    t.cloneNode(originalCall),
                                    key,
                                    namespace,
                                    template
                                );
                                
                                // Replace with wrapper (when variable is used in JSX, it'll have attributes)
                                parent.node.init = wrapper;
                                handled = true;
                                state.file.i18nStats.wrapped++;
                                state.file.i18nStats.patterns.variable++;
                            }
                            
                            // Case 3: Conditional like {condition ? t("yes") : t("no")}
                            else if (t.isConditionalExpression(parent.node)) {
                                // Check if parent conditional is in JSX-safe context
                                const conditionalParent = parent.parentPath;
                                if (canWrapInJSX(conditionalParent)) {
                                    const wrapper = createWrapper(
                                        t.cloneNode(originalCall),
                                        key,
                                        namespace,
                                        template
                                    );
                                    
                                    // Replace this branch
                                    if (parent.node.consequent === path.node) {
                                        parent.node.consequent = wrapper;
                                    } else if (parent.node.alternate === path.node) {
                                        parent.node.alternate = wrapper;
                                    }
                                    handled = true;
                                    state.file.i18nStats.wrapped++;
                                    state.file.i18nStats.patterns.conditional++;
                                }
                            }
                            
                            // Case 4: Object property like { title: t("key") }
                            else if (t.isObjectProperty(parent.node)) {
                                // Check if the object is eventually used in JSX
                                // For now, wrap it and hope it ends up in JSX
                                const wrapper = createWrapper(
                                    t.cloneNode(originalCall),
                                    key,
                                    namespace,
                                    template
                                );
                                parent.node.value = wrapper;
                                handled = true;
                                state.file.i18nStats.wrapped++;
                                state.file.i18nStats.patterns.other++;
                            }
                            
                            // Case 5: Assignment expression like x = t("key")
                            else if (t.isAssignmentExpression(parent.node)) {
                                const wrapper = createWrapper(
                                    t.cloneNode(originalCall),
                                    key,
                                    namespace,
                                    template
                                );
                                parent.node.right = wrapper;
                                handled = true;
                                state.file.i18nStats.wrapped++;
                                state.file.i18nStats.patterns.variable++;
                            }
                            
                            // Case 6: Array element like [t("a"), t("b")]
                            else if (t.isArrayExpression(parent.node)) {
                                const wrapper = createWrapper(
                                    t.cloneNode(originalCall),
                                    key,
                                    namespace,
                                    template
                                );
                                // Replace this element in the array
                                const index = parent.node.elements.indexOf(path.node);
                                if (index !== -1) {
                                    parent.node.elements[index] = wrapper;
                                    handled = true;
                                    state.file.i18nStats.wrapped++;
                                    state.file.i18nStats.patterns.other++;
                                }
                            }
                            
                            // Case 7: Return statement like return t("key")
                            else if (t.isReturnStatement(parent.node)) {
                                // Check if this function returns JSX (component)
                                const wrapper = createWrapper(
                                    t.cloneNode(originalCall),
                                    key,
                                    namespace,
                                    template
                                );
                                parent.node.argument = wrapper;
                                handled = true;
                                state.file.i18nStats.wrapped++;
                                state.file.i18nStats.patterns.other++;
                            }
                            
                            // Case 8: Logical expression like x && t("key")
                            else if (t.isLogicalExpression(parent.node)) {
                                const logicalParent = parent.parentPath;
                                if (canWrapInJSX(logicalParent)) {
                                    const wrapper = createWrapper(
                                        t.cloneNode(originalCall),
                                        key,
                                        namespace,
                                        template
                                    );
                                    
                                    // Replace the right side (usually where t() is)
                                    if (parent.node.right === path.node) {
                                        parent.node.right = wrapper;
                                    } else if (parent.node.left === path.node) {
                                        parent.node.left = wrapper;
                                    }
                                    handled = true;
                                    state.file.i18nStats.wrapped++;
                                    state.file.i18nStats.patterns.conditional++;
                                }
                            }
                            
                            // Track if we couldn't handle this pattern
                            if (!handled) {
                                state.file.i18nStats.skipped++;
                                state.file.i18nStats.patterns.other++;
                                const loc = path.node.loc;
                                const parentType = parent.node.type;
                                state.file.i18nStats.skippedReasons.push(
                                    `Unsupported context (${parentType}): t("${key}") at ${state.file.opts.filename}:${loc?.start.line || '?'}`
                                );
                            }
                        }
                    }
                }
            },
        },
    };
};

