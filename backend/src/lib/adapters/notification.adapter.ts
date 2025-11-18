import { logger } from '../logger';

export interface NotificationPayload {
  title: string;
  message: string;
  level: 'info' | 'warning' | 'error' | 'success';
  metadata?: Record<string, any>;
  recipients?: string[];
}

export interface INotificationAdapter {
  send(payload: NotificationPayload): Promise<void>;
}

/**
 * In-memory notification adapter (stub)
 * In production, replace with Email, Slack, webhook, or push notification service
 */
export class InMemoryNotificationAdapter implements INotificationAdapter {
  private notifications: Array<NotificationPayload & { sentAt: Date }> = [];

  async send(payload: NotificationPayload): Promise<void> {
    logger.info({ notification: payload }, 'Notification sent');
    this.notifications.push({
      ...payload,
      sentAt: new Date(),
    });
  }

  getNotifications() {
    return this.notifications;
  }

  clear() {
    this.notifications = [];
  }
}

/**
 * Webhook notification adapter
 */
export class WebhookNotificationAdapter implements INotificationAdapter {
  constructor(private webhookUrl: string) {}

  async send(payload: NotificationPayload): Promise<void> {
    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Webhook returned ${response.status}`);
      }

      logger.info({ webhookUrl: this.webhookUrl }, 'Notification sent via webhook');
    } catch (error: any) {
      logger.error({ err: error, webhookUrl: this.webhookUrl }, 'Webhook notification failed');
      throw error;
    }
  }
}

/**
 * Console notification adapter (for development)
 */
export class ConsoleNotificationAdapter implements INotificationAdapter {
  async send(payload: NotificationPayload): Promise<void> {
    const emoji = {
      info: '📘',
      warning: '⚠️',
      error: '❌',
      success: '✅',
    }[payload.level];

    console.log(`\n${emoji} ${payload.title}`);
    console.log(`  ${payload.message}`);
    if (payload.metadata) {
      console.log('  Metadata:', payload.metadata);
    }
  }
}

// Default adapter
export const notificationAdapter: INotificationAdapter = new InMemoryNotificationAdapter();
