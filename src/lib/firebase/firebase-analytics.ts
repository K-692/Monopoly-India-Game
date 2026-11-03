import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';
import { app } from './firebase-app';

let analytics: Analytics | null = null;

export async function initAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined') return null;
  try {
    const supported = await isSupported();
    if (supported) {
      analytics = getAnalytics(app);
    }
  } catch {
    // Analytics failed to initialize or blocked by ad-blocker
    analytics = null;
  }
  return analytics;
}
