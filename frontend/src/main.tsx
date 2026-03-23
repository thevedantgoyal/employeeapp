import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { runHostedAuthCleanupIfNeeded } from "./lib/authStorageCleanup";

runHostedAuthCleanupIfNeeded();

createRoot(document.getElementById("root")!).render(<App />);
