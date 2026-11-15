import { useCallback, useEffect, useState } from "react";

// P1.6 plan Q4: hand-written hash routing, no router dependency.
export type Route = "operations" | "reglages";

function readRoute(): Route {
  return window.location.hash === "#/reglages" ? "reglages" : "operations";
}

export function useHashRoute(): [Route, (route: Route) => void] {
  const [route, setRoute] = useState<Route>(readRoute);
  useEffect(() => {
    const onChange = () => setRoute(readRoute());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const navigate = useCallback((next: Route) => {
    window.location.hash = `#/${next}`;
  }, []);
  return [route, navigate];
}
