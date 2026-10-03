import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

function App() {
  return <main><h1>Lingo Store POS</h1><p>Web POS foundation. Terminal enrollment and cashier authentication come next.</p></main>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
