import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";

import { WagmiConfig } from "wagmi";
import { config } from "./wallet.js";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            <WagmiConfig config={config}>
                <App />
            </WagmiConfig>
        </QueryClientProvider>
    </React.StrictMode>
);








