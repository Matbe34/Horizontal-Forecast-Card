# Horizontal Forecast Card

A modern horizontal weather forecast card for Home Assistant with drag-to-scroll functionality.

## Features

- 🖱️ **Drag-to-scroll functionality** - Smooth horizontal scrolling with mouse and touch support
- ⚡ **Local SVG icons** - Fast loading weather icons embedded in the card
- 📱 **Mobile-responsive design** - Works perfectly on all screen sizes
- 🎨 **Clean UI** - Modern design with vertical separators for better readability
- 🔄 **Smart caching** - Efficient data handling and automatic refresh
- 🌡️ **Comprehensive display** - Shows temperature, precipitation, and weather conditions

## Installation

### Via HACS (Recommended)
1. Install HACS if you haven't already
2. Go to HACS > Frontend
3. Click the three dots in the top right corner
4. Select "Custom repositories"
5. Add this repository URL: `https://github.com/Matbe34/Horizontal-Forecast-Card`
6. Select "Lovelace" as the category
7. Click "Add"
8. Install the card from HACS

### Manual Installation
1. Download the `horizontal-forecast-card.js` file from the latest release
2. Copy it to your `www` folder in your Home Assistant configuration directory
3. Add the resource to your Lovelace configuration

## Configuration

```yaml
type: custom:horizontal-forecast-card
entity: weather.your_weather_entity
name: Weather Forecast
show_current: true
show_forecast: true
forecast_days: 5
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `entity` | string | **Required** | Weather entity |
| `name` | string | `Weather Forecast` | Card title |
| `show_current` | boolean | `true` | Show current conditions |
| `show_forecast` | boolean | `true` | Show forecast data |
| `forecast_days` | number | `5` | Number of forecast days |

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/Matbe34/Horizontal-Forecast-Card/issues) page.
