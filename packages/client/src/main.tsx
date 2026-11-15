import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { App } from "./app/App.js";
import { queryClient } from "./app/api.js";
import "./ui/tokens.css";

const root = document.getElementById("root");
if (root === null) {
  throw new Error("#root element missing in index.html");
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
