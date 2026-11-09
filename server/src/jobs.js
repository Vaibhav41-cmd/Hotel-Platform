import Redis from 'ioredis';
import { Queue, Worker } from 'bullmq';
import nodemailer from 'nodemailer';
import { logEvent } from './http.js';

const QUEUE_NAME = 'serein-notifications';

export async function initializeJobs() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    return {
      enqueue: async (name, payload) => logEvent('notification.not_queued', { job: name, hasRedis: false, recordId: payload.inquiryId || payload.bookingId }),
      close: async () => {},
    };
  }
  const queueConnection = new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });
  const workerConnection = new Redis(redisUrl, { maxRetriesPerRequest: null, enableReadyCheck: true });
  const queue = new Queue(QUEUE_NAME, { connection: queueConnection, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 4000 }, removeOnComplete: 100, removeOnFail: 200 } });
  let transporter;
  const worker = new Worker(QUEUE_NAME, async (job) => {
    if (!process.env.SMTP_HOST || !process.env.EMAIL_FROM) {
      logEvent('notification.skipped', { job: job.name, reason: 'SMTP is not configured' });
      return;
    }
    transporter ||= nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_SECURE || 'false') === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    });
    if (job.name === 'new-inquiry') {
      const recipient = process.env.FRONT_DESK_EMAIL || process.env.SMTP_USER;
      if (!recipient) return;
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: recipient,
        subject: `New stay enquiry from ${job.data.name}`,
        text: `A new enquiry was received from ${job.data.name} (${job.data.email}). Sign in to the Serein desk to review it.`,
      });
    } else if (job.name === 'booking-confirmation' && job.data.email) {
      await transporter.sendMail({
        from: process.env.EMAIL_FROM,
        to: job.data.email,
        subject: `Your Serein stay is confirmed · ${job.data.confirmation}`,
        text: `Your booking is confirmed. Your reference is ${job.data.confirmation}. We look forward to welcoming you.`,
      });
    }
    logEvent('notification.sent', { job: job.name, recordId: job.data.inquiryId || job.data.bookingId });
  }, { connection: workerConnection, concurrency: 5 });
  worker.on('failed', (job, error) => console.error(JSON.stringify({ level: 'error', event: 'notification.failed', job: job?.name, message: error.message })));
  await queue.waitUntilReady();
  logEvent('jobs.ready', { queue: QUEUE_NAME });
  return {
    enqueue: async (name, payload) => {
      try {
        await queue.add(name, payload);
      } catch (error) {
        console.error(JSON.stringify({ level: 'error', event: 'notification.enqueue_failed', job: name, message: error.message }));
      }
    },
    close: async () => {
      await Promise.all([worker.close(), queue.close(), queueConnection.quit(), workerConnection.quit()]);
    },
  };
}
