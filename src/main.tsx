import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "./i18n/config";

import { BatchProvider } from "./contexts/BatchContext";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BatchProvider>
      <App />
    </BatchProvider>
  </React.StrictMode>,
);
