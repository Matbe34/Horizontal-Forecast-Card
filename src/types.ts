import { LovelaceCard, LovelaceCardConfig, LovelaceCardEditor } from 'custom-card-helpers';

declare global {
  interface HTMLElementTagNameMap {
    'horizontal-forecast-card-editor': LovelaceCardEditor;
    'hui-error-card': LovelaceCard;
  }
}

export interface HorizontalForecastCardConfig extends LovelaceCardConfig {
  type: string;
  entity: string;
  name?: string;
  hours_to_show?: number;
  block_width?: string;
}

