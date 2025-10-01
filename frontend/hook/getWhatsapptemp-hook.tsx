import axios from "axios";
import { useEffect, useState } from "react";

export const useGetWhatsappTemplates = () => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const getWhatsappTemplates = async () => {
    try {
      setLoading(true);
      const base = process.env.NEXT_PUBLIC_BACKEND_URL;
      if (!base) {
        throw new Error("NEXT_PUBLIC_BACKEND_URL is not set");
      }

      const res = await axios.get(`${base}/api/messages/templates`, {
        headers: { Accept: "application/json" },
        timeout: 30000,
      });

      // Normalize possible shapes into a flat array
      const payload = res?.data;
      let normalized: any[] = [];
      if (Array.isArray(payload)) {
        normalized = payload;
      } else if (Array.isArray(payload?.data?.data)) {
        normalized = payload.data.data;
      } else if (Array.isArray(payload?.data)) {
        normalized = payload.data;
      } else {
        normalized = [];
      }
      setTemplates(normalized);
    } catch (err: any) {
      console.error("Failed to load WhatsApp templates:", err?.response?.data || err?.message || err);
      setError(err?.message || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getWhatsappTemplates();
  }, []);
  return { templates, loading, error };
};
