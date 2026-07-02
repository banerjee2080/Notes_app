import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from "./App"
import { Toaster } from 'react-hot-toast'
import { BrowserRouter } from 'react-router'

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster 
        position="top-center"
        toastOptions={{
          style: {
            background: "rgba(255, 255, 255, 0.05)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            color: "#fff",
            boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.3)",
          }
        }}
      />
    </BrowserRouter>
  </StrictMode>,
);
