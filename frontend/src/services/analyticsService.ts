import api from './api';
import { ComprehensiveAnalytics, TimePeriod } from '../types/analytics.types';

export async function getAnalytics(period: TimePeriod): Promise<ComprehensiveAnalytics> {
  const response = await api.get('/analytics', { params: { period } });
  return response.data.analytics;
}
