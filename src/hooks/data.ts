"use client";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { db, DEFAULT_PROFILE, getProfile } from "@/lib/db";
import type { EngineItem } from "@/lib/outfitEngine";
import type { Item, StyleProfile, Weather } from "@/lib/types";
import { fetchWeather } from "@/lib/weather";

export function useProfile(): StyleProfile | undefined {
  return useLiveQuery(() => getProfile(), [], undefined);
}

export function useItems(): Item[] | undefined {
  return useLiveQuery(() => db.items.orderBy("createdAt").reverse().toArray(), []);
}

export function toEngine(items: Item[]): EngineItem[] {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return items.map(({ image, thumb, ...rest }) => rest);
}

/** Object URL for a Blob, revoked automatically. */
export function useBlobUrl(blob?: Blob): string | undefined {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : undefined), [blob]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}

export type AiStatus = { ai: boolean; shopping: boolean };
let statusCache: Promise<AiStatus> | null = null;

export function useAiStatus(): AiStatus | undefined {
  const [s, setS] = useState<AiStatus>();
  useEffect(() => {
    statusCache ??= fetch("/api/ai/status")
      .then((r) => r.json())
      .catch(() => ({ ai: false, shopping: false }));
    statusCache.then(setS);
  }, []);
  return s;
}

const WEATHER_TTL = 30 * 60 * 1000;

export function useWeather(profile?: StyleProfile): { weather?: Weather; error?: string; loading: boolean } {
  const [state, setState] = useState<{ key: string; weather?: Weather; error?: string }>();
  const city = profile?.city;
  const key = city ? `weather:${city.latitude.toFixed(2)},${city.longitude.toFixed(2)}` : undefined;
  useEffect(() => {
    if (!city || !key) return;
    let alive = true;
    (async () => {
      try {
        const cached = JSON.parse(sessionStorage.getItem(key) ?? "null");
        if (cached && Date.now() - cached.at < WEATHER_TTL) {
          setState({ key, weather: cached.weather });
          return;
        }
      } catch {}
      try {
        const weather = await fetchWeather(city.latitude, city.longitude);
        try {
          sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), weather }));
        } catch {}
        if (alive) setState({ key, weather });
      } catch (e) {
        if (alive) setState({ key, error: String((e as Error).message ?? e) });
      }
    })();
    return () => {
      alive = false;
    };
  }, [city, key]);
  const current = state?.key === key ? state : undefined;
  return { weather: current?.weather, error: current?.error, loading: !!key && !current };
}

export { DEFAULT_PROFILE };
