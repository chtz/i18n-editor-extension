import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { onSigninCallback, userManager } from "./auth.ts";
import { RouterProvider } from "react-router-dom";
import { router } from "./routes";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import "./i18n.ts";
import { applicationQueryClient } from "@/createQueryClient.ts";
import { AuthProvider } from "react-oidc-context";
import { GATEWAY_DOWN_KEY } from "@/dev/gatewayDelay/GatewayDelay.tsx";
import { CheckSso } from "@/CheckSso.tsx";

import { installI18nDomTagger } from "./i18n-dom-tagger.ts";
installI18nDomTagger(); // support for i18n edit helper (dev mode)

/**
 * config.js properties
 * @see SPAConfigEndpoint
 */
declare global {
    // noinspection JSUnusedGlobalSymbols
    interface Window {
        configuration: {
            keycloakurl: string;
            keycloakrealm: string;
            keycloakclientId: string;
            kpenv: string;
            kp1caselinkprefix: string;
            gitCommitId: string;
            kp1schadenlinkprefix: string;
        };
    }
}

async function enableMockServiceWorker() {
    if (process.env.NODE_ENV !== "development") {
        return;
    }

    const { DELAYED_KEY } = await import("@/dev/gatewayDelay/GatewayDelay.tsx");
    const delayed = sessionStorage.getItem(DELAYED_KEY) === "true";
    const gatewayDown = sessionStorage.getItem(GATEWAY_DOWN_KEY) === "true";

    if (delayed || gatewayDown) {
        const { worker } = await import("./mocks/browser");
        // `worker.start()` returns a Promise that resolves
        // once the Service Worker is up and ready to intercept requests.
        await worker.start();
    }
    return;
}

enableMockServiceWorker().then(() => {
    createRoot(document.getElementById("root")!).render(
        <StrictMode>
            <AuthProvider userManager={userManager} onSigninCallback={onSigninCallback}>
                <CheckSso />
                <QueryClientProvider client={applicationQueryClient}>
                    <RouterProvider router={router} />
                    <ReactQueryDevtools initialIsOpen={false} />
                </QueryClientProvider>
            </AuthProvider>
        </StrictMode>,
    );
});
