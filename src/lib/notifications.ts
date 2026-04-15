// Feishu webhook notification service

export interface FeishuNotificationPayload {
  msg_type: "text" | "interactive";
  content: {
    text?: string;
  };
}

export interface NotificationConfig {
  webhookUrl: string;
  enabled: boolean;
}

export class FeishuNotificationService {
  private config: NotificationConfig;

  constructor(config: NotificationConfig) {
    this.config = config;
  }

  async sendText(text: string): Promise<boolean> {
    if (!this.config.enabled || !this.config.webhookUrl) {
      console.warn("Feishu notifications disabled or webhook URL not configured");
      return false;
    }

    try {
      const payload: FeishuNotificationPayload = {
        msg_type: "text",
        content: {
          text,
        },
      };

      const response = await fetch(this.config.webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error("Feishu notification failed:", response.statusText);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Feishu notification error:", error);
      return false;
    }
  }

  async notifyRecommendationCreated(alertTitle: string, recommendationId: string): Promise<boolean> {
    const text = `【推荐创建】\n预警「${alertTitle}」已升级为推荐\n推荐ID: ${recommendationId}\n请前往系统查看详情`;
    return this.sendText(text);
  }

  async notifyRecommendationExpiring(recommendationId: string, expiresIn: string): Promise<boolean> {
    const text = `【推荐到期提醒】\n推荐 ${recommendationId} 将在 ${expiresIn} 后到期\n请及时处理`;
    return this.sendText(text);
  }

  async notifyAlertTriggered(alertTitle: string, severity: string): Promise<boolean> {
    const text = `【预警触发】\n${alertTitle}\n严重程度: ${severity}\n请前往系统查看详情`;
    return this.sendText(text);
  }
}

// Singleton instance (client-side only)
let notificationService: FeishuNotificationService | null = null;

export function getNotificationService(): FeishuNotificationService {
  if (typeof window === "undefined") {
    throw new Error("Notification service can only be used on client side");
  }

  if (!notificationService) {
    // Load config from localStorage
    const config = loadNotificationConfig();
    notificationService = new FeishuNotificationService(config);
  }

  return notificationService;
}

export function updateNotificationConfig(config: NotificationConfig): void {
  if (typeof window === "undefined") return;

  localStorage.setItem("feishu_notification_config", JSON.stringify(config));
  notificationService = new FeishuNotificationService(config);
}

export function loadNotificationConfig(): NotificationConfig {
  if (typeof window === "undefined") {
    return { webhookUrl: "", enabled: false };
  }

  try {
    const stored = localStorage.getItem("feishu_notification_config");
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load notification config:", error);
  }

  return { webhookUrl: "", enabled: false };
}
