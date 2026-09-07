import { Injectable } from '@nestjs/common';

@Injectable()
export class AnalyticsDeduplicationService {
  private processedEvents = new Map<string, number>();

  /**
   * Check if eventId has already been processed within the last 60 seconds.
   * Returns true if it is a duplicate, false if new.
   */
  isDuplicate(eventId?: string): boolean {
    if (!eventId) return false;

    const now = Date.now();
    const existingExpiry = this.processedEvents.get(eventId);

    if (existingExpiry && existingExpiry > now) {
      return true;
    }

    // Register event with 60-second TTL
    this.processedEvents.set(eventId, now + 60000);

    // Periodic cleanup of expired event IDs
    if (this.processedEvents.size > 10000) {
      for (const [id, exp] of this.processedEvents.entries()) {
        if (exp <= now) {
          this.processedEvents.delete(id);
        }
      }
    }

    return false;
  }
}
