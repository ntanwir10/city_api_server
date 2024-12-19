# All-in-One City API

The All-in-One City API provides comprehensive, city-specific data, including weather, news, events, traffic, and general city information. It is designed for developers building applications that require dynamic and scalable city-related data services.

---

## Features
- **Weather**: Current and weekly forecasts with support for multiple units (Celsius/Fahrenheit).
- **News**: Up-to-date city-specific news headlines.
- **Events**: Details of upcoming events and activities.
- **Traffic**: Real-time traffic conditions for efficient planning.
- **City Information**: Key facts like population, geography, and more.

---

## Getting Started

### Base URL
```
https://api.yourdomain.com
```

### Authentication
The API requires an API key for authentication. Include it in the `Authorization` header:

```
Authorization: Bearer <YOUR_API_KEY>
```

---

## Endpoints

### Get City Information
Retrieve all available data for a city.

#### Endpoint:
```
GET /api/city/:cityName
```

#### Parameters:
| Name       | Type     | Required | Description                           |
|------------|----------|----------|---------------------------------------|
| `cityName` | `string` | Yes      | The name of the city to fetch details for. |
| `lang`     | `string` | No       | Language code for response (default: `en`). |

#### Headers:
| Name            | Type     | Required | Description                             |
|-----------------|----------|----------|-----------------------------------------|
| `Authorization` | `string` | Yes      | API key for authentication.              |
| `x-api-plan`    | `string` | Yes      | Subscription plan (`free`, `basic`, `pro`, `ultra`, `ultra_premium`).|

#### Example Request:
```
GET /api/city/NewYork?lang=en
Authorization: Bearer YOUR_API_KEY
x-api-plan: pro
```

#### Example Response:
```json
{
  "city": "New York",
  "city_info": {
    "name": "New York",
    "population": 8419600,
    "country": "United States",
    "coordinates": { "lat": 40.7128, "lng": -74.0060 },
    "source": "GeoNames API"
  },
  "weather": {
    "data": {
      "current": {
        "temperature_c": "18°C",
        "condition": "Sunny"
      },
      "forecast": [
        { "day": "Monday", "condition": "Cloudy", "temperature_c": "20°C" },
        { "day": "Tuesday", "condition": "Rainy", "temperature_c": "15°C" }
      ]
    },
    "source": "OpenWeatherMap"
  },
  "news": {
    "data": [
      "Tech Summit kicks off in New York City",
      "New York Marathon attracts record participation"
    ],
    "source": "NewsAPI"
  },
  "events": {
    "data": [
      "Broadway Show: Hamilton",
      "Art Exhibition at MoMA"
    ],
    "source": "Eventful API"
  },
  "traffic": {
    "traffic_status": "Heavy traffic on 5th Avenue",
    "source": "TomTom Traffic API"
  }
}
```

---

## Subscription Plans

| Plan          | Requests/Minute | Description                          |
|---------------|------------------|--------------------------------------|
| Free          | 50               | Limited access to endpoints.         |
| Basic         | 200              | Suitable for small applications.     |
| Pro           | 1000             | Designed for medium-scale applications.|
| Ultra         | 5000             | Enterprise-grade access.             |
| Ultra Premium | Unlimited        | Best for mission-critical applications.|

---

## Testing

### Postman Collection:
- Download the Postman collection from [this link](https://api.yourdomain.com/downloads/all_in_one_city_api_postman_collection.json).
- Import it into Postman and set your API key and subscription plan.

### Example cURL:
```
curl -X GET "https://api.yourdomain.com/api/city/London?lang=en" \
-H "Authorization: Bearer YOUR_API_KEY" \
-H "x-api-plan: basic"
```

---

## Support
For any issues, questions, or feedback, contact:
- **Email**: support@yourdomain.com
- **RapidAPI Messaging**: [Contact Us](https://rapidapi.com)

---

## License
This project is licensed under the MIT License. See the LICENSE file for details.

---

ENV variables -

`OPENWEATHER_API_KEY=your_openweather_api_key`
`WEATHERAPI_KEY=your_weatherapi_key`
`NEWSAPI_KEY=your_newsapi_key`
`GNEWS_KEY=your_gnews_api_key`
`TRAFFIC_API_KEY=your_tomtom_api_key`
`GEOCODING_API_KEY=your_openweathermap_api_key`
`GEONAMES_USERNAME=your_geonames_username`
