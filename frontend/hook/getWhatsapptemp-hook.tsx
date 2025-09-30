import axios from "axios";
import { useEffect, useState } from "react";

export const useGetWhatsappTemplates = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const getWhatsappTemplates = async () => {
    try {
      setLoading(true);
      const res = await axios.get(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/messages/templates`
      );
      setTemplates(res.data);
      setLoading(false);
    } catch (error) {
      console.log(error);
      setLoading(false);
    }
  };

  useEffect(() => {
    getWhatsappTemplates();
  }, []);
  return { templates, loading, error };
};
