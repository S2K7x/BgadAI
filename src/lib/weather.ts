/** Weather via Open-Meteo (free, no API key). */

/** fetch with exponential backoff on rate limits (429) and transient 5xx / network errors. */
async function fetchRetry(url: string, tries = 3): Promise<Response> {
  let last: Response | undefined;
  for (let i = 0; i < tries; i++) {
    try {
      last = await fetch(url);
      if (last.ok || (last.status < 500 && last.status !== 429)) return last;
    } catch (e) {
      if (i === tries - 1) throw e;
    }
    await new Promise((r) => setTimeout(r, 600 * 2 ** i));
  }
  return last!;
}
import type { Weather } from "./types";

export type GeoResult = { name: string; latitude: number; longitude: number; country?: string; admin1?: string };

export async function searchCity(name: string): Promise<GeoResult[]> {
  if (name.trim().length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name.trim())}&count=6&language=en&format=json`;
  const res = await fetchRetry(url);
  if (!res.ok) throw new Error(`Geocoding failed (${res.status})`);
  const data = (await res.json()) as { results?: GeoResult[] };
  return data.results ?? [];
}

const CODES: [number[], string, string][] = [
  [[0], "Clear sky", "☀️"],
  [[1, 2], "Partly cloudy", "⛅"],
  [[3], "Overcast", "☁️"],
  [[45, 48], "Fog", "🌫️"],
  [[51, 53, 55, 56, 57], "Drizzle", "🌦️"],
  [[61, 63, 65, 66, 67, 80, 81, 82], "Rain", "🌧️"],
  [[71, 73, 75, 77, 85, 86], "Snow", "❄️"],
  [[95, 96, 99], "Thunderstorm", "⛈️"],
];

export function describeCode(code: number): { summary: string; emoji: string } {
  const hit = CODES.find(([codes]) => codes.includes(code));
  return hit ? { summary: hit[1], emoji: hit[2] } : { summary: "—", emoji: "🌡️" };
}

export async function fetchWeather(latitude: number, longitude: number): Promise<Weather> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,apparent_temperature,weather_code",
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    forecast_days: "1",
    timezone: "auto",
  });
  const res = await fetchRetry(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Weather failed (${res.status})`);
  const d = await res.json();
  const code = d.current?.weather_code ?? 0;
  return {
    tempC: d.current?.temperature_2m,
    feelsLikeC: d.current?.apparent_temperature ?? d.current?.temperature_2m,
    tempMaxC: d.daily?.temperature_2m_max?.[0],
    tempMinC: d.daily?.temperature_2m_min?.[0],
    precipProb: d.daily?.precipitation_probability_max?.[0] ?? 0,
    code,
    ...describeCode(code),
  };
}

export type DayForecast = { date: string; tempMaxC: number; tempMinC: number; precipProb: number };

/** Daily forecast for a date range (Open-Meteo covers today … +15 days). Missing days are omitted. */
export async function fetchForecastRange(latitude: number, longitude: number, start: string, end: string): Promise<DayForecast[]> {
  // Forecasts change slowly: cache the 16-day window per place for 3 hours.
  const key = `forecast:${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  try {
    const hit = JSON.parse(localStorage.getItem(key) ?? "null");
    if (hit && Date.now() - hit.at < 3 * 3600_000) return (hit.days as DayForecast[]).filter((d) => d.date >= start && d.date <= end);
  } catch {}
  const all = await fetchForecastWindow(latitude, longitude);
  try {
    localStorage.setItem(key, JSON.stringify({ at: Date.now(), days: all }));
  } catch {}
  return all.filter((d) => d.date >= start && d.date <= end);
}

async function fetchForecastWindow(latitude: number, longitude: number): Promise<DayForecast[]> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: "16",
  });
  const res = await fetchRetry(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!res.ok) throw new Error(`Forecast failed (${res.status})`);
  const d = await res.json();
  const out: DayForecast[] = [];
  (d.daily?.time ?? []).forEach((date: string, i: number) => {
    out.push({
      date,
      tempMaxC: d.daily.temperature_2m_max[i],
      tempMinC: d.daily.temperature_2m_min[i],
      precipProb: d.daily.precipitation_probability_max?.[i] ?? 0,
    });
  });
  return out;
}

/** Daytime "feels like" estimate from a daily forecast. */
export function dayTemp(f: Pick<DayForecast, "tempMaxC" | "tempMinC">) {
  return f.tempMaxC * 0.65 + f.tempMinC * 0.35;
}
