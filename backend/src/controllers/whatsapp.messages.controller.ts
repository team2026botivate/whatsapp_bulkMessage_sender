import type { Request, Response } from 'express';
import axiosInstance from '../utils/axios.js';
import axios from 'axios';

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
  const PER_MESSAGE_MIN_DELAY_MS = Number(process.env.SEND_MIN_DELAY_MS ?? 1200); // 1.2s
  const PER_MESSAGE_MAX_DELAY_MS = Number(process.env.SEND_MAX_DELAY_MS ?? 2400); // 2.4s
  const BETWEEN_BATCH_DELAY_MS = Number(process.env.SEND_BATCH_DELAY_MS ?? 10000); // 10s
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

  const buildPayload = (to: string) => {
    // Dynamic components construction
    let finalComponents = components || [];

    // If no components provided but we have contacts, and it's a legacy call relying on the hardcoded logic (optional compatibility)
    // We strictly follow the new 'components' param. If it's missing, we send NO components.
    // However, we need to replace variable placeholders with actual contact data.

    // Deep clone components to avoid mutating the original reference if we were reusing it
    const localizedComponents = finalComponents.map((comp: any) => {
      // Logic to replace variables with contact data would go here
      // For now, we assume the frontend passes the raw structure or we implement basic variable substitution if needed.
      // But a better approach is: The frontend sends the *structure* of components, and we inject values.

      // IF the user passes components that already have values (static), we use them.
      // IF the user passes components that need substitution (e.g. using a placeholder convention), we handle it.

      // SIMPLE FIX FOR NOW:
      // If the user provided components, we use them.
      // We need to inject the specific contact's name if there is a placeholder.
      // But the current request from UI likely WON'T send components yet.

      // To solve the IMMEDIATE error (0 params expected, 1 sent):
      // We Default to EMPTY components if none are provided.
      return comp;
    });

    // Advanced: If components are provided, we might need to map {{name}} to contact.name
    // Let's implement a simple replacer: if a parameter text is '{{name}}', replace it.
    const processedComponents = localizedComponents.map((comp: any) => {
      if (comp.type === 'body' || comp.type === 'header') {
        if (comp.parameters) {
          return {
            ...comp,
            parameters: comp.parameters.map((param: any) => {
              // Only replace placeholders in text-type parameters
              // Skip image/video/document parameters entirely
              if (param.type !== 'text') return param;

              if (param.text === '{{name}}') {
                return { ...param, text: contacts.find((c) => c.phone === to)?.name || '' };
              }
              if (param.text === '{{phone}}') {
                return { ...param, text: to };
              }
              // Any other text (custom text) passes through as-is
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
        // Backoff for rate limits or transient errors
        if (status === 429 || (status >= 500 && status < 600)) {
          const backoff = Math.min(30000, 1000 * Math.pow(2, attempt));
          await sleep(backoff + jitter(0, 500));
          attempt++;
          continue;
        }
        // Non-retryable error
        throw err;
      }
    }
    throw new Error('Max retries reached');
  };

  (async () => {
    const batches = chunk(contacts, BATCH_SIZE);
    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      for (const contact of batch) {
        const to = String(contact.phone || '').replace(/[^\d+]/g, '');
        if (!to) continue;
        try {
          await sendWithRetry(to);
        } catch (e: any) {
          console.error('Failed to send to', to, e?.response?.data ?? e?.message ?? String(e));
        }
        await sleep(jitter(PER_MESSAGE_MIN_DELAY_MS, PER_MESSAGE_MAX_DELAY_MS));
      }
      if (b < batches.length - 1) {
        await sleep(BETWEEN_BATCH_DELAY_MS);
      }
    }
  })().catch((e: any) =>
    console.error('Background send error:', e?.response?.data ?? e?.message ?? String(e))
  );

  return res.status(200).json({ success: true, message: 'Messages queued for sending' });
};

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
