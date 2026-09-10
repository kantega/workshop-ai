import { useEffect, useState } from "react";
import Debug from "./Debug";
import Home from "./Home";

/**
 * Minste mulige ruter: to sider, ingen ruter-avhengighet. Vite serverer index.html for alle
 * stier i dev, så /debug treffer denne komponenten og ikke en 404.
 */
export default function App() {
  const [path, setPath] = useState(() => window.location.pathname);

  useEffect(() => {
    const onPopState = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const route = path.replace(/\/+$/, "") || "/";

  if (route === "/debug") return <Debug />;
  return <Home />;
}
