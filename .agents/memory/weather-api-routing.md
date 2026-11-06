---
name: Weather API routing
description: CORS and usage constraints for adding browser-facing weather data to AI Partner 01.
---

The free Open-Meteo endpoints can be called without an API key for prototype/non-commercial use, but their responses do not expose a browser CORS allow-origin header. Browser features should call the same-origin API server, which then calls geocoding and forecast services. Keep provider terms in mind if the project becomes commercial.

**Why:** A direct request from the web app would be blocked by browser CORS even though the provider API itself returns valid data.

**How to apply:** For new weather intents, keep the UI request behind the project API route and validate the request/response with the OpenAPI-generated schemas. Do not route weather text into generic chat fallback when provider access fails.
