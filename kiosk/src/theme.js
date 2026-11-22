// Resident mobile palette, with semantic kiosk aliases.
export const C = {
  darkPine: '#174B35',
  leaf: '#65A66F',
  sageGreen: '#296445',
  mutedTeal: '#467657',
  goldAmber: '#E9AE59',
  earthGold: '#B8A26A',
  warmGray: '#D8E2D5',
  deepNavy: '#203B2E',
  skyBlue: '#F8FAF4',
  iceMint: '#E7F0E4',
  surfaceBg: '#F4F5EB',
  cardBg: '#FFFFFF',
  textMuted: '#63786A',
  error: '#A63D2F',
  white: '#FFFFFF',
  black: '#000000',
  chip: '#FFD54F',
  amberSoft: '#FFECB3',
};

/** Same as Compose's Color.copy(alpha = a): a hex color with transparency. */
export function alpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
