// city_api_server.js - Node.js Server for City Information API

import express from "express";
import axios from "axios";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import UserAgent from "user-agents";
import NodeCache from "node-cache";

const app = express();
const PORT = 3000;
const ENV = process.env.NODE_ENV || "development"; // Set environment mode

// Cache setup
const cache = new NodeCache({ stdTTL: 3600 }); // Cache results for 1 hour

let proxyList = [];
if (ENV !== "production") {
  // Load proxyList.json only in development mode
  import("./proxyList.json", { assert: { type: "json" } })
    .then((module) => {
      proxyList = module.default;
      console.log("Proxy list loaded in development mode.");
    })
    .catch((err) => {
      console.error("Error loading proxy list:", err.message);
    });
}

// Enable CORS and security headers
app.use(cors());
app.use(helmet());
app.use(express.json());

// Subscription Plans
const rateLimits = {
  free: { windowMs: 30 * 60 * 1000, max: 50 }, // 30 minutes in milliseconds with max 50 requests
  basic: { windowMs: 20 * 60 * 1000, max: 200 }, // 20 minutes in milliseconds with max 200 requests
  pro: { windowMs: 20 * 60 * 1000, max: 1000 }, // 20 minutes in milliseconds with max 1000 requests
  ultra: { windowMs: 10 * 60 * 1000, max: 5000 }, // 10 minutes in milliseconds with max 5000 requests
  ultra_premium: { windowMs: 5 * 60 * 1000, max: 999999 }, // 5 minitues in milliseconds with Effectively unlimited
};
const validPlans = Object.keys(rateLimits);

// Dynamic Rate Limiter with Plan Validation
const dynamicRateLimiter = (req, res, next) => {
  const userPlan = req.headers["x-api-plan"];

  if (!userPlan || !validPlans.includes(userPlan)) {
    return res.status(400).json({
      error:
        "Invalid or missing subscription plan. Please specify a valid plan: free, basic, pro, ultra.",
    });
  }

  const limiter = rateLimit({
    windowMs: rateLimits[userPlan].windowMs,
    max: rateLimits[userPlan].max,
    message: {
      error: `Rate limit exceeded for '${userPlan}' plan. Upgrade your plan to increase your quota.`,
    },
    handler: (req, res) => {
      res.status(429).json({
        error: `Rate limit exceeded for '${userPlan}' plan. Upgrade to a higher plan for more access.`,
      });
    },
  });
  return limiter(req, res, next);
};

app.use("/api/", dynamicRateLimiter);

// ? Utility: Rotate User-Agent and Proxies for resilience (Production Mode Only)
const validateProxy = async (proxy) => {
  try {
    const testUrl = "https://httpbin.org/ip";
    await axios.get(testUrl, {
      proxy: {
        host: proxy.host,
        port: proxy.port,
        auth: proxy.username
          ? { username: proxy.username, password: proxy.password }
          : undefined,
      },
      timeout: 5000,
    });
    return true;
  } catch (error) {
    console.warn(`Proxy validation failed: ${proxy.host}:${proxy.port}`);
    return false;
  }
};

/**
 @function getValidProxy 
 @description Selects a valid proxy from the proxyList.json file by validating it (development mode only) 
 */

const getValidProxy = async (maxRetries = 5) => {
  if (ENV === "production")
    throw new Error("Proxy rotation is not enabled in production.");
  let retries = 0;
  while (retries < maxRetries && proxyList.length > 0) {
    const randomIndex = Math.floor(Math.random() * proxyList.length);
    const proxy = proxyList[randomIndex];
    if (await validateProxy(proxy)) {
      return proxy;
    }
    retries++;
    console.warn(`Retrying to fetch a valid proxy. Attempt: ${retries}`);
  }
  throw new Error("No valid proxies available after maximum retries.");
};

/**
 * @function axiosWithRotation
 * @description
 * The function axiosWithRotation serves as a resilient HTTP request handler for:
 * Proxy Rotation,
 * User-Agent Rotation,
 * Response Caching,
 * Environment-Specific Behavior
 * Error Handling
 */
const axiosWithRotation = async (url) => {
  const userAgent = new UserAgent();

  // Check cache first
  const cachedData = cache.get(url);
  if (cachedData) {
    console.log(`Serving cached data for: ${url}`);
    return { data: cachedData };
  }

  if (ENV === "production") {
    try {
      const response = await axios.get(url, {
        headers: { "User-Agent": userAgent.toString() },
        timeout: 10000,
      });
      cache.set(url, response.data); // Store result in cache
      return response;
    } catch (error) {
      console.error(`Request Failed (${url}). Error: ${error.message}`);
      throw new Error("Failed to fetch data from the source.");
    }
  } else {
    try {
      const proxy = await getValidProxy();
      const response = await axios.get(url, {
        headers: { "User-Agent": userAgent.toString() },
        proxy: {
          host: proxy.host,
          port: proxy.port,
          auth: proxy.username
            ? { username: proxy.username, password: proxy.password }
            : undefined,
        },
        timeout: 10000,
      });
      cache.set(url, response.data); // Store result in cache
      return response;
    } catch (error) {
      console.error(
        `Failed to fetch data with proxy rotation (${url}). Proxy Details: ${error.message}`
      );
      throw new Error(
        "Failed to fetch data from the source after proxy retries."
      );
    }
  }
};

// Fetch Weather Data
// This function attempts to fetch weather data from multiple sources.
// It first tries OpenWeatherMap API, and if that fails, it falls back to WeatherAPI.
// If both APIs fail, it returns a message indicating weather data is unavailable.
// The function returns an object containing the weather data and the source API used.
// @param {string} cityName - The name of the city for which to fetch weather data.
// @returns {object} - An object containing the weather data and the source API used.
const fetchWeatherData = async (cityName) => {
  const weatherApiKey = process.env.OPENWEATHER_API_KEY;
  const weatherUrls = [
    `https://api.openweathermap.org/data/2.5/forecast?q=${cityName}&units=metric&appid=${weatherApiKey}`,
    `https://api.weatherapi.com/v1/forecast.json?key=${process.env.WEATHERAPI_KEY}&q=${cityName}&days=7`,
  ];
  // Iterate through the weather API URLs, attempting to fetch data
  // If a request succeeds, return the data and source API
  for (const url of weatherUrls) {
    try {
      const response = await axiosWithRotation(url);
      return { data: response.data, source: url };
    } catch (error) {
      console.warn(`Weather API fallback triggered for ${url}`);
    }
  }
  // If all API calls fail, return an error message
  return { data: "Weather data unavailable", source: "None" };
};

// Fetch News Data
// This function attempts to fetch news data related to the given city from multiple sources.
// It first tries NewsAPI, and if that fails, it falls back to GNews.
// If both APIs fail, it returns a message indicating news data is unavailable.
// The function returns an object containing an array of news article titles and the source API used.
// @param {string} cityName - The name of the city for which to fetch news data.
const fetchNewsData = async (cityName) => {
  const newsApiKey = process.env.NEWSAPI_KEY;
  const newsUrls = [
    `https://newsapi.org/v2/everything?q=${cityName}&apiKey=${newsApiKey}`,
    `https://gnews.io/api/v4/search?q=${cityName}&lang=en&token=${process.env.GNEWS_KEY}`,
  ];
  // Iterate through the news API URLs, attempting to fetch data
  // If a request succeeds, return the article titles and source API
  for (const url of newsUrls) {
    try {
      const response = await axiosWithRotation(url);
      const articles = response.data.articles
        .slice(0, 10)
        .map((article) => article.title);
      return { data: articles, source: url };
    } catch (error) {
      console.warn(`News API fallback triggered for ${url}`);
    }
  }
  // If all API calls fail, return an error message
  return { data: "News data unavailable", source: "None" };
};

// Fetch Events Data
// This function attempts to fetch event data for the given city from the Eventful API.
// If the API call is successful, it returns an array of event titles and venue names.
// If the API call fails, it returns a message indicating that event data is unavailable.
// @param {string} cityName - The name of the city for which to fetch event data.
const fetchEventsData = async (cityName) => {
  const eventsApiKey = process.env.EVENTS_API_KEY;
  const eventsUrl = `https://api.eventful.com/json/events/search?location=${cityName}&app_key=${eventsApiKey}`;

  try {
    const response = await axiosWithRotation(eventsUrl);
    const events = response.data.events?.event || [];
    return {
      data: events.slice(0, 10).map((e) => `${e.title} at ${e.venue_name}`),
      source: eventsUrl,
    };
  } catch (error) {
    console.warn(`Failed to fetch events data: ${error.message}`);
    return { data: "Events data unavailable", source: "None" };
  }
};

// Fetch Traffic Information
// This function attempts to fetch traffic information for the given city.
// It first uses a geocoding API (OpenWeatherMap) to get coordinates for the city.
// Then, it uses those coordinates to fetch traffic data from TomTom Traffic API.
// If either API call fails, it returns a message indicating that traffic data is unavailable.
// @param {string} cityName - The name of the city for which to fetch traffic information.
const fetchTrafficData = async (cityName) => {
  const trafficApiKey = process.env.TRAFFIC_API_KEY; // Ensure this is added to your .env file
  const geocodingApiKey = process.env.GEOCODING_API_KEY;

  try {
    // Step 1: Convert city name to coordinates using a geocoding API
    const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${cityName}&limit=1&appid=${geocodingApiKey}`;
    const geoResponse = await axiosWithRotation(geoUrl);
    const location = geoResponse.data[0];

    if (!location)
      throw new Error("Geolocation data unavailable for the city.");

    const { lat, lon } = location;

    // Step 2: Fetch traffic data based on coordinates
    const trafficUrl = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?key=${trafficApiKey}&point=${lat},${lon}`;
    const trafficResponse = await axiosWithRotation(trafficUrl);
    const trafficData = trafficResponse.data;

    return {
      traffic_status: trafficData?.flowSegmentData?.currentSpeed
        ? `Current speed: ${trafficData.flowSegmentData.currentSpeed} km/h`
        : "Traffic data unavailable",
      source: trafficUrl,
    };
  } catch (error) {
    console.warn(
      `Failed to fetch traffic data for ${cityName}: ${error.message}`
    );
    return { traffic_status: "Traffic data unavailable", source: "None" };
  }
};

// Fetch City Information
// This function tries to fetch basic city information (name, population, country, coordinates)
// from multiple sources, using a fallback mechanism if one source fails.
// It first tries GeoNames API, then Wikipedia API, and finally OpenWeatherMap Geocoding API.
// If all sources fail, it returns an error message.
// @param {string} cityName - The name of the city for which to fetch information.
// @returns {object} - An object containing city information or an error message.
const fetchCityInfo = async (cityName) => {
  const geoNamesUrl = `http://api.geonames.org/searchJSON?q=${cityName}&maxRows=1&username=${process.env.GEONAMES_USERNAME}`;
  const wikipediaUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${cityName}`;
  const geoCodingUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${cityName}&limit=1&appid=${process.env.GEOCODING_API_KEY}`;

  try {
    // Attempt to fetch from GeoNames API
    const response = await axiosWithRotation(geoNamesUrl);
    if (response.data.geonames.length > 0) {
      const cityData = response.data.geonames[0];
      return {
        name: cityData.name,
        population: cityData.population || "Data unavailable",
        country: cityData.countryName,
        coordinates: { lat: cityData.lat, lon: cityData.lng },
        source: geoNamesUrl,
      };
    }
  } catch (error) {
    console.warn(`GeoNames API failed: ${error.message}`);
  }

  try {
    // Fallback to Wikipedia API
    const wikiResponse = await axiosWithRotation(wikipediaUrl);
    return {
      name: wikiResponse.data.title,
      description: wikiResponse.data.extract || "Description unavailable",
      image: wikiResponse.data.thumbnail?.source || "No image available",
      source: wikipediaUrl,
    };
  } catch (error) {
    console.warn(`Wikipedia API failed: ${error.message}`);
  }

  try {
    // Fallback to OpenWeatherMap Geocoding API
    const geoResponse = await axiosWithRotation(geoCodingUrl);
    if (geoResponse.data.length > 0) {
      const location = geoResponse.data[0];
      return {
        name: location.name,
        coordinates: { lat: location.lat, lon: location.lon },
        country: location.country,
        source: geoCodingUrl,
      };
    }
  } catch (error) {
    console.warn(`OpenWeatherMap Geocoding failed: ${error.message}`);
  }

  return { error: "City information unavailable", source: "None" };
};

// Combined City API Endpoint
// This endpoint handles requests for city information, combining data from various sources:
// - City details (name, population, country, coordinates)
// - Weather forecast
// - News articles
// - Events
// - Traffic information
app.get("/api/city/:cityName", async (req, res) => {
  const cityName = req.params.cityName;

  try {
    const [
      cityResponse,
      weatherResponse,
      newsResponse,
      eventsResponse,
      trafficResponse,
    ] = await Promise.allSettled([
      fetchCityInfo(cityName),
      fetchWeatherData(cityName),
      fetchNewsData(cityName),
      fetchEventsData(cityName),
      fetchTrafficData(cityName),
    ]);

    res.json({
      city: cityName,
      city_info:
        cityResponse.status === "fulfilled"
          ? cityResponse.value.data
          : { error: "City data unavailable" },
      weather:
        weatherResponse.status === "fulfilled"
          ? weatherResponse.value
          : { data: "Weather data unavailable" },
      news:
        newsResponse.status === "fulfilled"
          ? newsResponse.value
          : { data: "News data unavailable" },
      events:
        eventsResponse.status === "fulfilled"
          ? eventsResponse.value
          : { data: "Events data unavailable" },
      traffic:
        trafficResponse.status === "fulfilled"
          ? trafficResponse.value
          : { traffic_status: "Traffic data unavailable" },
    });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error fetching city data", message: error.message });
  }
});

// Start the server
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT} in ${ENV} mode`)
);
