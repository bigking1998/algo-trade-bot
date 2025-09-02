import { Timeframe } from '../../shared/types/trading';

export const TF_TO_RESOLUTION: Record<Timeframe, string> = {
  '1m': '1MIN',
  '5m': '5MIN',
  '15m': '15MIN',
  '30m': '30MIN',
  '1h': '1HOUR',
  '4h': '4HOUR',
  '1d': '1DAY',
};

/**
 * Map internal Timeframe to dYdX Indexer resolution string.
 */
export function tfToResolution(tf: Timeframe): string {
  return TF_TO_RESOLUTION[tf];
}

/**
 * Validate and normalize ISO time inputs for query parameters.
 * Returns undefined if input is falsy or invalid ISO string.
 */
export function normalizeIsoTime(input?: string): string | undefined {
  if (!input) return undefined;
  // Basic ISO validation; dayjs is available but avoid extra imports here
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}
