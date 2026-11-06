import type { WeatherForecast } from '@workspace/api-client-react';

export type WeatherIntent = {
  location: string | null;
  date: string;
  dateLabel: string;
};

function tokyoToday(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function makeDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function findRequestedDate(text: string, today: string): string {
  const fullJapaneseDate = text.match(/(20\d{2})年(\d{1,2})月(\d{1,2})日?/u);
  const fullNumericDate = text.match(/(20\d{2})[./-](\d{1,2})[./-](\d{1,2})/u);
  const fullMatch = fullJapaneseDate ?? fullNumericDate;
  if (fullMatch) {
    const date = makeDate(Number(fullMatch[1]), Number(fullMatch[2]), Number(fullMatch[3]));
    if (date) return date;
  }

  const shortDate = text.match(/(\d{1,2})月(\d{1,2})日/u);
  if (shortDate) {
    const date = makeDate(
      Number(today.slice(0, 4)),
      Number(shortDate[1]),
      Number(shortDate[2]),
    );
    if (date) return date;
  }

  if (/明後日|あさって/u.test(text)) return addDays(today, 2);
  if (/明日|あした|tomorrow/i.test(text)) return addDays(today, 1);
  return today;
}

function formatDateLabel(date: string, today: string): string {
  const dayDifference = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  if (dayDifference === 0) return '今日';
  if (dayDifference === 1) return '明日';
  if (dayDifference === 2) return '明後日';
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

function extractLocation(text: string): string | null {
  const location = text
    .replace(/20\d{2}年\d{1,2}月\d{1,2}日?/gu, ' ')
    .replace(/20\d{2}[./-]\d{1,2}[./-]\d{1,2}/gu, ' ')
    .replace(/\d{1,2}月\d{1,2}日/gu, ' ')
    .replace(/明後日|あさって|明日|あした|今日|本日|今夜|今朝|現在|今|tomorrow|today/giu, ' ')
    .replace(/天気予報|天気|天候|降水確率|気温|晴れ|曇り|くもり|雪|雨|雷雨/gu, ' ')
    .replace(/教えて(?:ください)?|知りたい(?:です)?|調べて(?:ください)?|見せて|予報/gu, ' ')
    .replace(/地域|場所|あたり|周辺/gu, ' ')
    .replace(/[のはがをにで、。,.!?？！「」『』（）()【】\[\]\s]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  return location || null;
}

export function parseWeatherIntent(
  text: string,
  now = new Date(),
): WeatherIntent | null {
  if (!/天気|天候|気温|降水確率|雨|晴れ|曇り|くもり|雪|雷雨/u.test(text)) {
    return null;
  }

  const today = tokyoToday(now);
  const date = findRequestedDate(text, today);
  return {
    location: extractLocation(text),
    date,
    dateLabel: formatDateLabel(date, today),
  };
}

function formatTemperature(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatWeatherReply(
  forecast: WeatherForecast,
  requestedDateLabel: string,
): string {
  const place = forecast.region
    ? `${forecast.locationName}（${forecast.region}）`
    : forecast.locationName;
  const precipitation = forecast.precipitationProbabilityPercent === null
    ? ''
    : ` 降水確率は${forecast.precipitationProbabilityPercent}%。`;

  return `${place}の${requestedDateLabel}の天気は${forecast.condition}だよ。最高気温は${formatTemperature(forecast.temperatureHighC)}℃、最低気温は${formatTemperature(forecast.temperatureLowC)}℃。${precipitation}`;
}
