// src/main.tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import "./index.css";

// (Opcional) se você tiver contextos:
// import { AuthProvider } from "./contexts/AuthContext";
// import { GamificationProvider } from "./contexts/GamificationContext";
// import { Toaster } from "react-hot-toast";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      {/* <AuthProvider>
        <GamificationProvider> */}
          <App />
          {/* <Toaster position="top-right" /> */}
        {/* </GamificationProvider>
      </AuthProvider> */}
    </BrowserRouter>
  </StrictMode>
);
