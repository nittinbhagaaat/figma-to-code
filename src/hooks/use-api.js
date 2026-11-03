"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/client-api";

/** Tiny data-fetching hook: { data, error, loading, reload, setData }. Pass null url to skip. */
export function useApi(url) {
  const [state, setState] = useState({ data: undefined, error: null, loading: !!url });
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!url) return;
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.get(url);
      if (id === seq.current) setState({ data, error: null, loading: false });
    } catch (error) {
      if (id === seq.current) setState((s) => ({ ...s, error, loading: false }));
    }
  }, [url]);
  useEffect(() => { load(); }, [load]);
  // Before the first fetch resolves there is no data yet — that must read as loading, never as an empty/undefined state.
  const loading = state.loading || (!!url && state.data === undefined && !state.error);
  return { ...state, loading, reload: load, setData: (data) => setState((s) => ({ ...s, data })) };
}
