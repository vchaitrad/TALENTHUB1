import { useEffect, useState } from "react";
import { FALLBACK_META, getCachedMeta, preloadMeta } from "./meta";

export function useMeta() {
  const [meta, setMeta] = useState(getCachedMeta());

  useEffect(() => {
    let active = true;
    preloadMeta().then((data) => {
      if (active) setMeta(data);
    });
    return () => {
      active = false;
    };
  }, []);

  return meta || FALLBACK_META;
}
