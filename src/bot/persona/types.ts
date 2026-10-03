export type PersonaIntensityLevel = 'serious' | 'normal' | 'showtime';

export interface PersonaConfig {
  enabled: boolean;
  level: PersonaIntensityLevel;
}
