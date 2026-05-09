import { useState, useEffect } from "react";

const _cache = {};

/**
 * Fetch a Wikipedia article summary on demand.
 * Uses the publicly documented REST API v1 (CORS-enabled for browser use).
 * Results are cached for the lifetime of the page.
 *
 * @param {string|null} articleTitle  Wikipedia article title (underscores OK)
 * @returns {{ data: object|null, loading: boolean, error: string|null }}
 */
export function useWikipediaSummary(articleTitle) {
  const [state, setState] = useState({ data: null, loading: false, error: null });

  useEffect(() => {
    if (!articleTitle) {
      setState({ data: null, loading: false, error: null });
      return;
    }
    if (_cache[articleTitle]) {
      setState({ data: _cache[articleTitle], loading: false, error: null });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(articleTitle)}`,
      { headers: { Accept: "application/json" } }
    )
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        if (cancelled) return;
        _cache[articleTitle] = d;
        setState({ data: d, loading: false, error: null });
      })
      .catch((e) => {
        if (cancelled) return;
        setState({ data: null, loading: false, error: e.message });
      });
    return () => { cancelled = true; };
  }, [articleTitle]);

  return state;
}

/** Return the first n sentences of a Wikipedia extract string. */
export function firstSentences(text, n = 2) {
  if (!text) return null;
  const parts = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [];
  return parts.slice(0, n).join("").trim() || text.slice(0, 220);
}
