import nodemailer from "nodemailer";

export type NotificationPayload = {
  subject: string;
  text: string;
  html?: string;
  to?: string;
  replyTo?: string;
};

export type EmailNotificationReadiness = {
  prepared: true;
  transport: "smtp";
  configured: boolean;
  fromConfigured: boolean;
  recipientConfigured: boolean;
  transportConfigured: boolean;
  issues: string[];
};

type EmailNotificationConfig = {
  host: string;
  port: number;
  portValid: boolean;
  secure: boolean;
  secureValid: boolean;
  user: string;
  pass: string;
  from: string;
  to: string;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;

function parsePort(value: string) {
  const port = Number(value);
  return {
    port,
    valid: Number.isInteger(port) && port > 0 && port <= 65_535,
  };
}

function parseSecure(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "true") return { secure: true, valid: true };
  if (normalized === "false") return { secure: false, valid: true };
  return { secure: false, valid: false };
}

function readConfig(): EmailNotificationConfig {
  const parsedPort = parsePort(process.env.SMTP_PORT?.trim() || "");
  const parsedSecure = parseSecure(process.env.SMTP_SECURE?.trim() || "");
  return {
    host: process.env.SMTP_HOST?.trim() || "",
    port: parsedPort.port,
    portValid: parsedPort.valid,
    secure: parsedSecure.secure,
    secureValid: parsedSecure.valid,
    user: process.env.SMTP_USER?.trim() || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.NOTIFICATION_EMAIL_FROM?.trim() || "",
    to: process.env.NOTIFICATION_EMAIL_TO?.trim() || "",
  };
}

function readiness(config: EmailNotificationConfig): EmailNotificationReadiness {
  const issues: string[] = [];
  if (!config.host) issues.push("SMTP_HOST is missing");
  if (!config.portValid) issues.push("SMTP_PORT is invalid");
  if (!config.secureValid) issues.push("SMTP_SECURE must be true or false");
  if (!config.user) issues.push("SMTP_USER is missing");
  if (!config.pass) issues.push("SMTP_PASS is missing");
  if (!config.from) issues.push("NOTIFICATION_EMAIL_FROM is missing");
  else if (!emailPattern.test(config.from)) issues.push("NOTIFICATION_EMAIL_FROM is invalid");
  if (!config.to) issues.push("NOTIFICATION_EMAIL_TO is missing");
  else if (!emailPattern.test(config.to)) issues.push("NOTIFICATION_EMAIL_TO is invalid");

  return {
    prepared: true,
    transport: "smtp",
    configured: issues.length === 0,
    fromConfigured: Boolean(config.from),
    recipientConfigured: Boolean(config.to),
    transportConfigured: Boolean(
      config.host
      && config.portValid
      && config.secureValid
      && config.user
      && config.pass,
    ),
    issues,
  };
}

function safeErrorMessage(error: unknown, secret: string) {
  const message = error instanceof Error ? error.message : "SMTP notification failed";
  return secret ? message.replaceAll(secret, "[redacted]") : message;
}

export function getEmailNotificationReadiness() {
  return readiness(readConfig());
}

export async function notifyByEmail(payload: NotificationPayload) {
  const config = readConfig();
  const state = readiness(config);
  if (!state.configured) {
    return {
      delivered: false,
      reason: `Email notifications are not configured: ${state.issues.join(", ")}`,
    };
  }

  const recipient = payload.to?.trim() || config.to;
  if (!emailPattern.test(recipient)) {
    return { delivered: false, reason: "Email notification recipient is invalid" };
  }

  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
    tls: {
      minVersion: "TLSv1.2",
      servername: config.host,
    },
  });

  try {
    const info = await transport.sendMail({
      from: config.from,
      to: recipient,
      replyTo: payload.replyTo && emailPattern.test(payload.replyTo) ? payload.replyTo : undefined,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    return { delivered: true, messageId: info.messageId };
  } catch (error) {
    return { delivered: false, reason: safeErrorMessage(error, config.pass) };
  } finally {
    transport.close();
  }
}
