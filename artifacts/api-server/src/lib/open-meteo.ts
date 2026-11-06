import {
  GetWeatherResponse,
  type WeatherForecast,
} from "@workspace/api-zod";

type JsonRecord = Record<string, unknown>;

type GeocodedPlace = {
  name: string;
  region: string | null;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string | null;
};

export class WeatherLocationNotFoundError extends Error {
  constructor() {
    super("Weather location was not found");
    this.name = "WeatherLocationNotFoundError";
  }
}

export class WeatherForecastUnavailableError extends Error {
  constructor() {
    super("Weather forecast date is unavailable");
    this.name = "WeatherForecastUnavailableError";
  }
}

function asRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function readString(record: JsonRecord, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readFiniteNumber(record: JsonRecord, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

async function fetchJson(url: URL): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`Open-Meteo returned HTTP ${response.status}`);
  }
  return response.json() as Promise<unknown>;
}

async function findPlace(query: string): Promise<GeocodedPlace> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", query);
  url.searchParams.set("count", "10");
  url.searchParams.set("language", "ja");
  url.searchParams.set("format", "json");

  const payload = asRecord(await fetchJson(url));
  const rows = payload && Array.isArray(payload.results)
    ? payload.results.map(asRecord).filter((row): row is JsonRecord => row !== null)
    : [];
  const queryIsJapanese = /[\u3040-\u30ff\u3400-\u9fff]/u.test(query);
  const place = queryIsJapanese
    ? rows.find((row) => readString(row, "country_code")?.toUpperCase() === "JP") ?? rows[0]
    : rows[0];

  if (!place) throw new WeatherLocationNotFoundError();

  const name = readString(place, "name");
  const country = readString(place, "country");
  const latitude = readFiniteNumber(place, "latitude");
  const longitude = readFiniteNumber(place, "longitude");
  if (!name || !country || latitude === null || longitude === null) {
    throw new WeatherLocationNotFoundError();
  }

  return {
    name,
    region: readString(place, "admin1"),
    country,
    latitude,
    longitude,
    timezone: readString(place, "timezone"),
  };
}

function numberAt(record: JsonRecord, key: string, index: number): number | null {
  const values = record[key];
  if (!Array.isArray(values)) return null;
  const value = values[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringArray(record: JsonRecord, key: string): string[] {
  const values = record[key];
  return Array.isArray(values)
    ? values.filter((value): value is string => typeof value === "string")
    : [];
}

function tokyoDateNow(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateLabel(date: string): string {
  const now = tokyoDateNow();
  const targetDay = Date.parse(`${date}T00:00:00Z`);
  const today = Date.parse(`${now}T00:00:00Z`);
  const daysFromToday = Math.round((targetDay - today) / 86_400_000);
  if (daysFromToday === 0) return "今日";
  if (daysFromToday === 1) return "明日";
  if (daysFromToday === 2) return "明後日";
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

function weatherDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: "快晴",
    1: "晴れ",
    2: "晴れ時々くもり",
    3: "くもり",
    45: "霧",
    48: "着氷性の霧",
    51: "弱い霧雨",
    53: "霧雨",
    55: "強い霧雨",
    56: "弱い着氷性の霧雨",
    57: "強い着氷性の霧雨",
    61: "弱い雨",
    63: "雨",
    65: "強い雨",
    66: "弱い着氷性の雨",
    67: "強い着氷性の雨",
    71: "弱い雪",
    73: "雪",
    75: "大雪",
    77: "雪あられ",
    80: "弱いにわか雨",
    81: "にわか雨",
    82: "強いにわか雨",
    85: "弱い雪のにわか雪",
    86: "強い雪のにわか雪",
    95: "雷雨",
    96: "ひょうを伴う雷雨",
    99: "強いひょうを伴う雷雨",
  };
  return descriptions[code] ?? "天気の詳細は不明";
}

export async function getOpenMeteoForecast(
  locationQuery: string,
  date: string,
): Promise<WeatherForecast> {
  const place = await findPlace(locationQuery);
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(place.latitude));
  url.searchParams.set("longitude", String(place.longitude));
  url.searchParams.set(
    "daily",
    "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
  );
  url.searchParams.set("timezone", place.timezone ?? "auto");
  url.searchParams.set("forecast_days", "16");

  const forecast = asRecord(await fetchJson(url));
  const daily = forecast ? asRecord(forecast.daily) : null;
  if (!daily) throw new Error("Open-Meteo returned an invalid forecast");

  const dates = stringArray(daily, "time");
  const index = dates.indexOf(date);
  if (index < 0) throw new WeatherForecastUnavailableError();

  const weatherCode = numberAt(daily, "weather_code", index);
  const temperatureHighC = numberAt(daily, "temperature_2m_max", index);
  const temperatureLowC = numberAt(daily, "temperature_2m_min", index);
  if (
    weatherCode === null ||
    temperatureHighC === null ||
    temperatureLowC === null
  ) {
    throw new Error("Open-Meteo returned incomplete daily weather data");
  }

  return GetWeatherResponse.parse({
    locationName: place.name,
    region: place.region,
    country: place.country,
    date,
    dateLabel: dateLabel(date),
    condition: weatherDescription(weatherCode),
    weatherCode,
    temperatureHighC,
    temperatureLowC,
    precipitationProbabilityPercent: numberAt(
      daily,
      "precipitation_probability_max",
      index,
    ),
  });
}
