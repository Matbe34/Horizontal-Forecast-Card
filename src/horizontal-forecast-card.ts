import { LitElement, html, css, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, hasConfigOrEntityChanged } from 'custom-card-helpers';
import { HorizontalForecastCardConfig } from './types';
import { weatherIconMap, day, night, cloudy_day_3, cloudy_night_3 } from './weather-icons';

@customElement('horizontal-forecast-card')
export class HorizontalForecastCard extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private config!: HorizontalForecastCardConfig;
  @state() private forecast: any[] = [];
  @state() private forecastError: string | null = null;
  @state() private loading: boolean = false;
  private container?: HTMLDivElement;
  private dragging = false;
  private startX = 0;
  private scrollLeftPos = 0;
  private forecastCache: { [key: string]: { data: any[], timestamp: number } } = {};
  private readonly CACHE_DURATION = 300000; // 5 minutes cache
  private boundOnDrag: (e: Event) => void;
  private boundStopDrag: (e?: Event) => void;

  constructor() {
    super();
    this.boundOnDrag = this._onDrag.bind(this);
    this.boundStopDrag = this._stopDrag.bind(this);
  }

  setConfig(config: HorizontalForecastCardConfig): void {
    if (!config.entity) throw new Error('Entity is required');
    this.config = {
      name: 'Forecast',
      hours_to_show: 24,
      block_width: '80px',
      ...config,
    };
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (hasConfigOrEntityChanged(this, changedProps, false)) {
      // Only fetch if we don't have cached data or it's expired
      const cacheKey = this.config?.entity;
      const cached = cacheKey ? this.forecastCache[cacheKey] : null;
      if (!cached || (Date.now() - cached.timestamp) > this.CACHE_DURATION) {
        this._fetchForecast();
      }
      return true;
    }
    return true;
  }

  private async _fetchForecast(): Promise<void> {
    if (!this.hass || !this.config?.entity) return;

    // Check cache first
    const cacheKey = this.config.entity;
    const cached = this.forecastCache[cacheKey];
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
      this.forecast = cached.data;
      this.forecastError = null;
      this.loading = false;
      return;
    }

    this.loading = true;
    
    try {
      const stateObj = this.hass.states[this.config.entity];
      
      // First, try to get forecast from attributes (fastest method)
      if (stateObj?.attributes.forecast && Array.isArray(stateObj.attributes.forecast)) {
        this.forecast = stateObj.attributes.forecast;
        this.forecastError = null;
        this.loading = false;
        this._cacheData(cacheKey, this.forecast);
        return;
      }

      // Try alternative attribute names (still fast)
      const forecast = stateObj?.attributes.forecast_hourly || 
                      stateObj?.attributes.hourly_forecast ||
                      stateObj?.attributes.forecast_daily ||
                      stateObj?.attributes.daily_forecast;
      
      if (forecast && Array.isArray(forecast)) {
        this.forecast = forecast;
        this.forecastError = null;
        this.loading = false;
        this._cacheData(cacheKey, this.forecast);
        return;
      }

      // Only try service calls if supported_features indicates support
      if (stateObj?.attributes.supported_features && (stateObj.attributes.supported_features & 1) === 1) {
        try {
          // Add timeout to prevent hanging
          const response = await Promise.race([
            this.hass.connection.sendMessagePromise({
              type: 'call_service',
              domain: 'weather',
              service: 'get_forecasts',
              service_data: {
                entity_id: this.config.entity,
                type: 'hourly'
              },
              return_response: true
            }) as any,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
          ]);

          if (response && response.response && response.response[this.config.entity]) {
            const forecastData = response.response[this.config.entity].forecast;
            if (forecastData && Array.isArray(forecastData)) {
              this.forecast = forecastData;
              this.forecastError = null;
              this.loading = false;
              this._cacheData(cacheKey, this.forecast);
              return;
            }
          }
        } catch (serviceError) {
          console.warn('Failed to get hourly forecast via websocket:', serviceError);
          
          // Try daily forecast as fallback with timeout
          try {
            const response = await Promise.race([
              this.hass.connection.sendMessagePromise({
                type: 'call_service',
                domain: 'weather',
                service: 'get_forecasts',
                service_data: {
                  entity_id: this.config.entity,
                  type: 'daily'
                },
                return_response: true
              }) as any,
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
            ]);

            if (response && response.response && response.response[this.config.entity]) {
              const forecastData = response.response[this.config.entity].forecast;
              if (forecastData && Array.isArray(forecastData)) {
                this.forecast = forecastData;
                this.forecastError = null;
                this.loading = false;
                this._cacheData(cacheKey, this.forecast);
                return;
              }
            }
          } catch (dailyError) {
            console.warn('Failed to get daily forecast via websocket:', dailyError);
          }
        }
      }

      // Final fallback
      this.forecast = [];
      this.forecastError = null;
      this.loading = false;
      
    } catch (error) {
      console.error('Error fetching forecast:', error);
      this.forecast = [];
      this.forecastError = `Error fetching forecast: ${error}`;
      this.loading = false;
    }
  }

  private _cacheData(key: string, data: any[]): void {
    this.forecastCache[key] = {
      data: [...data],
      timestamp: Date.now()
    };
  }

  protected firstUpdated(_changedProperties: PropertyValues) {
    super.firstUpdated(_changedProperties);
    
    // Get reference to the forecast container
    this.container = this.shadowRoot?.querySelector('.forecast') as HTMLDivElement;
    
    if (this.container) {
      // Set initial cursor style
      this.container.style.cursor = 'grab';
      
      // Add global listeners for drag operations
      document.addEventListener('mousemove', this.boundOnDrag);
      document.addEventListener('mouseup', this.boundStopDrag);
      document.addEventListener('touchmove', this.boundOnDrag, { passive: false });
      document.addEventListener('touchend', this.boundStopDrag);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    
    // Clean up global listeners
    document.removeEventListener('mousemove', this.boundOnDrag);
    document.removeEventListener('mouseup', this.boundStopDrag);
    document.removeEventListener('touchmove', this.boundOnDrag);
    document.removeEventListener('touchend', this.boundStopDrag);
  }

  private _startDrag(e: Event) {
    if (!this.container) return;
    
    this.dragging = true;
    
    // Get the correct clientX based on event type
    const mouseEvent = e as MouseEvent;
    const touchEvent = e as any; // TouchEvent might not be available
    
    if (e.type === 'touchstart' && touchEvent.touches && touchEvent.touches.length > 0) {
      this.startX = touchEvent.touches[0].clientX;
    } else {
      this.startX = mouseEvent.clientX;
    }
    
    this.scrollLeftPos = this.container.scrollLeft;
    
    // Prevent default to avoid text selection and touch scrolling
    e.preventDefault();
    e.stopPropagation();
    
    // Change cursor to grabbing for mouse events
    if (e.type === 'mousedown') {
      this.container.style.cursor = 'grabbing';
    }
  }

  private _onDrag(e: Event) {
    if (!this.dragging || !this.container) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Get the correct clientX based on event type
    let currentX: number;
    const mouseEvent = e as MouseEvent;
    const touchEvent = e as any; // TouchEvent might not be available
    
    if (e.type === 'touchmove' && touchEvent.touches && touchEvent.touches.length > 0) {
      currentX = touchEvent.touches[0].clientX;
    } else {
      currentX = mouseEvent.clientX;
    }
    
    const dx = currentX - this.startX;
    this.container.scrollLeft = this.scrollLeftPos - dx;
  }

  private _stopDrag(e?: Event) {
    if (!this.dragging || !this.container) return;
    
    this.dragging = false;
    
    // Restore cursor for mouse events
    this.container.style.cursor = 'grab';
    
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  render() {
    if (!this.config || !this.hass) return html``;
    
    const stateObj = this.hass.states[this.config.entity];
    if (!stateObj) {
      return html`<hui-warning>Entity "${this.config.entity}" not found</hui-warning>`;
    }

    // Check if it's a weather entity
    if (!stateObj.entity_id.startsWith('weather.')) {
      return html`<hui-warning>Entity must be a weather entity</hui-warning>`;
    }

    if (this.forecastError) {
      return html`<hui-warning>${this.forecastError}</hui-warning>`;
    }

    // Show loading state
    if (this.loading) {
      return html`
        <ha-card class="type-custom-weather-card">
          <div class="loading">
            <ha-circular-progress active></ha-circular-progress>
            <div>Loading forecast...</div>
          </div>
        </ha-card>
      `;
    }

    if (!this.forecast || this.forecast.length === 0) {
      // Debug information to help users
      const debugInfo = {
        entityId: this.config.entity,
        hasAttributes: !!stateObj.attributes,
        attributeKeys: Object.keys(stateObj.attributes || {}),
        supportedFeatures: stateObj.attributes.supported_features
      };
      
      console.warn('Horizontal Forecast Card Debug:', debugInfo);
      
      return html`
        <hui-warning>
          Weather entity "${this.config.entity}" has no forecast data in attributes. 
          <br><br>
          <strong>Possible solutions:</strong><br>
          1. Check if your weather integration supports forecast attributes<br>
          2. Try a different weather integration (e.g., Met.no, OpenWeatherMap)<br>
          3. Some integrations require enabling forecast in configuration<br>
          <br>
          <strong>Debug info:</strong><br>
          Entity has attributes: ${!!stateObj.attributes ? 'Yes' : 'No'}<br>
          Available attributes: ${Object.keys(stateObj.attributes || {}).join(', ')}<br>
          Supported features: ${stateObj.attributes.supported_features || 'Unknown'}<br>
          <br>
          Check the browser console for more details.
        </hui-warning>
      `;
    }

    const forecastData = this.forecast.slice(0, this.config.hours_to_show);
    
    return html`
      <ha-card class="type-custom-weather-card">
        <div class="forecast clear"
          style="--block-width: ${this.config.block_width};"
          @mousedown=${this._startDrag}
          @mouseup=${this._stopDrag}
          @mouseleave=${this._stopDrag}
          @touchstart=${this._startDrag}
          @touchmove=${this._onDrag}
          @touchend=${this._stopDrag}>
          ${forecastData.map((item: any) => {
            const time = new Date(item.datetime);
            const hour = time.getHours();
            const period = hour >= 12 ? 'PM' : 'AM';
            const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
            const timeString = `${displayHour.toString().padStart(2, '0')}:00 ${period}`;
            
            // Determine icon using local weather icons
            let iconDataUrl = day; // default
            
            if (item.condition && weatherIconMap[item.condition]) {
              iconDataUrl = weatherIconMap[item.condition];
              
              // Handle time-dependent icons with local assets
              if (item.condition === 'partlycloudy') {
                iconDataUrl = hour >= 7 && hour <= 19 ? cloudy_day_3 : cloudy_night_3;
              } else if (item.condition === 'sunny') {
                iconDataUrl = hour >= 7 && hour <= 19 ? day : night;
              }
            } else if (hour >= 19 || hour <= 6) {
              iconDataUrl = night;
            }
            
            // Handle temperature with fallbacks
            const temp = item.temperature ?? item.temp ?? item.templow ?? 'N/A';
            
            // Handle precipitation
            const precipitation = item.precipitation ?? item.rain ?? 0;
            
            return html`
              <div class="day">
                <div class="dayname">${timeString}</div>
                <i class="icon" style="background: none, url('${iconDataUrl}') no-repeat; background-size: contain"></i>
                <div class="highTemp">${temp}°C</div>
                <div class="precipitation">${precipitation} mm</div>
              </div>`;
          })}
        </div>
      </ha-card>
    `;
  }

  static styles = css`
    ha-card {
      overflow: hidden;
    }
    .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px;
      gap: 16px;
      color: var(--secondary-text-color);
    }
    .forecast {
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scroll-behavior: smooth;
      -webkit-overflow-scrolling: touch;
      cursor: grab;
      padding: 16px 0;
      user-select: none;
      -webkit-user-select: none;
      -moz-user-select: none;
      -ms-user-select: none;
    }
    .forecast:active {
      cursor: grabbing;
    }
    .day {
      flex: 0 0 var(--block-width, 80px);
      text-align: center;
      padding: 8px;
      scroll-snap-align: start;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      position: relative;
    }
    .day:not(:last-child)::after {
      content: '';
      position: absolute;
      right: 0;
      top: 10%;
      bottom: 10%;
      width: 2px;
      background-color: var(--divider-color, rgba(252, 252, 252, 0.94));
      opacity: 0.9;
    }
    .dayname {
      font-size: 0.85em;
      color: var(--secondary-text-color);
      white-space: nowrap;
    }
    .icon {
      width: 48px;
      height: 48px;
      display: block;
      background-size: contain !important;
      background-repeat: no-repeat !important;
      background-position: center !important;
    }
    .highTemp {
      font-weight: bold;
      font-size: 1.1em;
      color: var(--primary-text-color);
    }
    .precipitation {
      font-size: 0.8em;
      color: var(--secondary-text-color);
    }
    .clear {
      /* Additional styling for clear layout */
    }
  `;
}
