import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpApi from "i18next-http-backend";
import LanguageDetector from "i18next-browser-languagedetector";

import reviewedDe from "@/assets/locales/de/reviewed.json?url";
import oldDe from "@/assets/locales/de/old.json?url";

import reviewedFr from "@/assets/locales/fr/reviewed.json?url";
import oldFr from "@/assets/locales/fr/old.json?url";

import reviewedEn from "@/assets/locales/en/reviewed.json?url";
import oldEn from "@/assets/locales/en/old.json?url";

export const ALL_NAMESPACES = ["reviewed", "old"] as const;
export type ALL_NAMESPACES_KEYS = (typeof ALL_NAMESPACES)[number];

i18n.use({
    type: "postProcessor",
    name: "i18nmark",
    process(value: string, key: string, opts: any, translator: any) {
        if (process.env.NODE_ENV !== "development") return value;
        const ns = (opts && (opts.ns as string)) || translator?.translator?.options?.defaultNS || "translation";
        // [[i18n|ns|key]]value[[/i18n]]
        return `[[i18n|${ns}|${key}]]${value}[[/i18n]]`;
    },
}); // support for i18n edit helper (dev mode)

i18n.use(HttpApi)
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        postProcess: ["i18nmark"], // support for i18n edit helper (dev mode)
        ns: ALL_NAMESPACES,
        defaultNS: "reviewed",
        fallbackNS: "old",
        fallbackLng: "de",
        detection: {
            order: ["localStorage", "navigator"],
            caches: ["localStorage"],
        },
        load: "languageOnly",
        interpolation: {
            escapeValue: false,
        },
        backend: {
            loadPath: (languages: string[], namespaces: string) => {
                const language = languages[0];
                const ns = namespaces[0];
                const linksToTranslationFiles: Record<string, Record<string, string>> = {
                    de: {
                        old: oldDe,
                        reviewed: reviewedDe,
                    },
                    fr: {
                        old: oldFr,
                        reviewed: reviewedFr,
                    },
                    en: {
                        old: oldEn,
                        reviewed: reviewedEn,
                    },
                } as const;

                return linksToTranslationFiles[language][ns];
            },
        },
    })
    .catch((error) => console.error("Failed to initialize translations", error));
