import { useEffect, useState } from "react";
import { apiGet } from "../api";

export function useApiGet<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<T>(path)
      .then((value) => {
        if (!alive) return;
        setData(value);
        setError("");
      })
      .catch((err: Error) => {
        if (!alive) return;
        setError(err.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [path]);

  return { data, error, loading };
}
