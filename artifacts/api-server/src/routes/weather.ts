import { Router, type IRouter } from "express";
import { GetWeatherQueryParams } from "@workspace/api-zod";
import {
  getOpenMeteoForecast,
  WeatherForecastUnavailableError,
  WeatherLocationNotFoundError,
} from "../lib/open-meteo";

const router: IRouter = Router();

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

router.get("/weather", async (req, res): Promise<void> => {
  const parsed = GetWeatherQueryParams.safeParse(req.query);
  if (!parsed.success || !isCalendarDate(parsed.data.date)) {
    res.status(400).json({ error: "A location and valid YYYY-MM-DD date are required." });
    return;
  }

  try {
    const forecast = await getOpenMeteoForecast(
      parsed.data.location.trim(),
      parsed.data.date,
    );
    res.json(forecast);
  } catch (error) {
    if (error instanceof WeatherLocationNotFoundError) {
      res.status(404).json({ error: "Location not found." });
      return;
    }
    if (error instanceof WeatherForecastUnavailableError) {
      res.status(404).json({ error: "Forecast is not available for that date." });
      return;
    }

    req.log.error({ err: error }, "Weather provider request failed");
    res.status(502).json({ error: "Weather provider is unavailable." });
  }
});

export default router;
