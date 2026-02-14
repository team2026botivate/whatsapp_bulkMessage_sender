import type { Request, Response } from 'express';
import axiosInstance from '../utils/axios.js';
import axios from 'axios';
import crypto from 'crypto';

// ==================== Job Tracker ====================
type ContactResult = {
  phone: string;
  name: string;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
  whatsappMessageId?: string;
  timestamp?: string;
};

type Job = {
  id: string;
  status: 'running' | 'completed';
  totalContacts: number;
  sent: number;
  failed: number;
  pending: number;
  results: ContactResult[];
  createdAt: string;
  completedAt?: string;
};

// In-memory store (keeps last 50 jobs, auto-cleans older ones)
const jobStore = new Map<string, Job>();
const MAX_JOBS = 50;

const cleanupOldJobs = () => {
  if (jobStore.size > MAX_JOBS) {
    const entries = [...jobStore.entries()];
    entries.sort((a, b) => new Date(a[1].createdAt).getTime() - new Date(b[1].createdAt).getTime());
    const toRemove = entries.slice(0, entries.length - MAX_JOBS);
    toRemove.forEach(([key]) => jobStore.delete(key));
  }
};

// ==================== Send Template Message ====================
export const whatsappSendTemplateMessage = async (req: Request, res: Response) => {
  const { contacts, templateId, templateName, templateLanguage, components } = req.body as {
    contacts: Array<{ phone: string; name?: string }>;
    templateId?: string;
    templateName: string;
    templateLanguage?: string;
    components?: any[];
  };

  if (!Array.isArray(contacts) || contacts.length === 0) {
    return res.status(400).json({ success: false, error: 'No contacts provided' });
  }
  if (!templateName) {
    return res.status(400).json({ success: false, error: 'templateName is required' });
  }

  const BATCH_SIZE = Number(process.env.SEND_BATCH_SIZE ?? 50);
  const PER_MESSAGE_MIN_DELAY_MS = Number(process.env.SEND_MIN_DELAY_MS ?? 1200);
  const PER_MESSAGE_MAX_DELAY_MS = Number(process.env.SEND_MAX_DELAY_MS ?? 2400);
  const BETWEEN_BATCH_DELAY_MS = Number(process.env.SEND_BATCH_DELAY_MS ?? 10000);
  const MAX_RETRIES = 2;

  const jitter = (min: number, max: number) => Math.floor(min + Math.random() * (max - min));
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const chunk = <T>(arr: T[], size: number): T[][] => {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const endpoint = process.env.WHATSAPP_END_POINT;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!endpoint || !token) {
    return res.status(500).json({ success: false, error: 'WhatsApp API config missing' });
  }

  // Create job
  const jobId = crypto.randomUUID();
  const job: Job = {
    id: jobId,
    status: 'running',
    totalContacts: contacts.length,
    sent: 0,
    failed: 0,
    pending: contacts.length,
    results: contacts.map((c) => ({
      phone: String(c.phone || '').replace(/[^\d+]/g, ''),
      name: c.name || '',
      status: 'pending' as const,
    })),
    createdAt: new Date().toISOString(),
  };
  jobStore.set(jobId, job);
  cleanupOldJobs();

  const buildPayload = (to: string) => {
    let finalComponents = components || [];

    const processedComponents = finalComponents.map((comp: any) => {
      if (comp.type === 'body' || comp.type === 'header') {
        if (comp.parameters) {
          return {
            ...comp,
            parameters: comp.parameters.map((param: any) => {
              if (param.type !== 'text') return param;

              if (param.text === '{{name}}') {
                return { ...param, text: contacts.find((c) => c.phone === to)?.name || '' };
              }
              if (param.text === '{{phone}}') {
                return { ...param, text: to };
              }
              return param;
            }),
          };
        }
      }
      return comp;
    });

    return {
      messaging_product: 'whatsapp',
      to: `91${to}`,
      type: 'template',
      template: {
        name: templateName,
        language: {
          policy: 'deterministic',
          code: templateLanguage || 'en_US',
        },
        components: processedComponents,
      },
    };
  };

  const sendOnce = async (to: string) => {
    const payload = buildPayload(to);
    const { data } = await axios({
      method: 'POST',
      url: endpoint,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      data: payload,
      timeout: 30000,
    });
    return data;
  };

  const sendWithRetry = async (to: string) => {
    let attempt = 0;
    while (attempt < MAX_RETRIES) {
      try {
        return await sendOnce(to);
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 429 || (status >= 500 && status < 600)) {
          const backoff = Math.min(30000, 1000 * Math.pow(2, attempt));
          await sleep(backoff + jitter(0, 500));
          attempt++;
          continue;
        }
        throw err;
      }
    }
    throw new Error('Max retries reached');
  };

  // Background sending with tracking
  (async () => {
    const batches = chunk(contacts, BATCH_SIZE);
    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      for (const contact of batch) {
        const to = String(contact.phone || '').replace(/[^\d+]/g, '');
        if (!to) {
          // Mark as failed - invalid phone
          const resultItem = job.results.find((r) => r.phone === to || r.phone === '');
          if (resultItem) {
            resultItem.status = 'failed';
            resultItem.error = 'Invalid phone number';
            resultItem.timestamp = new Date().toISOString();
            job.failed++;
            job.pending--;
          }
          continue;
        }

        const resultItem = job.results.find((r) => r.phone === to && r.status === 'pending');
        try {
          const apiResponse = await sendWithRetry(to);
          if (resultItem) {
            resultItem.status = 'sent';
            resultItem.whatsappMessageId = apiResponse?.messages?.[0]?.id || '';
            resultItem.timestamp = new Date().toISOString();
            job.sent++;
            job.pending--;
          }
        } catch (e: any) {
          const errorMsg =
            e?.response?.data?.error?.message ||
            e?.response?.data?.error?.error_data?.details ||
            e?.message ||
            'Unknown error';
          console.error('Failed to send to', to, errorMsg);
          if (resultItem) {
            resultItem.status = 'failed';
            resultItem.error = errorMsg;
            resultItem.timestamp = new Date().toISOString();
            job.failed++;
            job.pending--;
          }
        }
        await sleep(jitter(PER_MESSAGE_MIN_DELAY_MS, PER_MESSAGE_MAX_DELAY_MS));
      }
      if (b < batches.length - 1) {
        await sleep(BETWEEN_BATCH_DELAY_MS);
      }
    }
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
    console.log(`Job ${jobId} completed: ${job.sent} sent, ${job.failed} failed`);
  })().catch((e: any) => {
    console.error('Background send error:', e?.response?.data ?? e?.message ?? String(e));
    job.status = 'completed';
    job.completedAt = new Date().toISOString();
  });

  // Return job ID immediately
  return res.status(200).json({
    success: true,
    message: 'Messages queued for sending',
    jobId,
    totalContacts: contacts.length,
  });
};

// ==================== Get Job Status ====================
export const getJobStatus = async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = jobStore.get(jobId);

  if (!job) {
    return res.status(404).json({ success: false, error: 'Job not found' });
  }

  return res.status(200).json({
    success: true,
    job: {
      id: job.id,
      status: job.status,
      totalContacts: job.totalContacts,
      sent: job.sent,
      failed: job.failed,
      pending: job.pending,
      createdAt: job.createdAt,
      completedAt: job.completedAt,
      results: job.results,
    },
  });
};

// ==================== Get Templates ====================
export const getWhatsappTemplates = async (req: Request, res: Response) => {
  try {
    if (!process.env.WHATSAPP_BUSSINESS_ACCOUNT_BASE_URL || !process.env.WHATSAPP_ACCESS_TOKEN) {
      throw new Error('Whatsapp end point not found');
    }
    const { data } = await axiosInstance({
      method: 'GET',
      url: `${process.env.WHATSAPP_BUSSINESS_ACCOUNT_BASE_URL}/682293507566285/message_templates?access_token=${process.env.WHATSAPP_ACCESS_TOKEN}`,
    });

    return res.status(200).json({ message: 'done', data: data });
  } catch (error: any) {
    const status = error?.response?.status;
    const errData = error?.response?.data;
    console.error('WhatsApp API error:', {
      status,
      data: errData,
      message: error?.message,
    });
    const httpStatus = typeof status === 'number' ? status : 500;
    return res
      .status(httpStatus)
      .json({ message: 'Failed to send WhatsApp message', error: errData ?? error?.message });
  }
};
