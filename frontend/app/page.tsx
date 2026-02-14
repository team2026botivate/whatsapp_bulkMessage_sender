"use client";
import { useGetWhatsappTemplates } from "@/hook/getWhatsapptemp-hook";
import { supabase } from "@/lib/supabase";
import axios from "axios";
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Image as ImageIcon,
  Loader,
  Send,
  Sheet,
  BookTemplate as Template,
  Upload,
  Users,
  X,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// -------------------- Types --------------------
type Contact = {
  id: number;
  name: string;
  phone: string;
};

type ToastType = {
  show: boolean;
  message: string;
  type: "success" | "error" | "";
};

type SheetsData = {
  sheetId: string;
  sheetName: string;
};

type TemplatesType = {
  name: string;
  id: string;
  category: string;
  language: string;
  status: string;
  components?: any[];
};

// For body/header variables: "name" | "phone" | "custom"
type VarMapping = {
  source: "name" | "phone" | "custom";
  customValue: string;
};

const page: React.FC = () => {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    try {
      const loggedIn =
        typeof window !== "undefined" &&
        localStorage.getItem("wbms_logged_in") === "true";
      if (!loggedIn) {
        router.replace("/login");
      } else {
        setAuthChecked(true);
      }
    } catch {
      router.replace("/login");
    }
  }, [router]);

  const [sheetsData, setSheetsData] = useState<SheetsData>({
    sheetId: "",
    sheetName: "",
  });

  const [isLoadingContacts, setIsLoadingContacts] = useState(false);
  const [contactsError, setContactsError] = useState("");
  const {
    templates: templatesData,
    loading,
    error,
  } = useGetWhatsappTemplates();

  const _rawT = templatesData as any;
  const templatesList: TemplatesType[] = Array.isArray(_rawT)
    ? (_rawT as TemplatesType[])
    : Array.isArray(_rawT?.data?.data)
      ? (_rawT.data.data as TemplatesType[])
      : Array.isArray(_rawT?.data)
        ? (_rawT.data as TemplatesType[])
        : [];

  const [messageData, setMessageData] = useState<{
    contacts: Contact[];
    templateId: string;
    templateName: string;
    templateLanguage?: string;
  }>({
    contacts: [],
    templateId: "",
    templateName: "",
  });

  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  // Header state
  const [headerFormat, setHeaderFormat] = useState<string>(""); // "IMAGE", "VIDEO", "DOCUMENT", "TEXT", ""
  const [headerImageUrl, setHeaderImageUrl] = useState(""); // Public URL after upload
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState("");

  // Parsed params from template
  const [parsedParams, setParsedParams] = useState<{
    header: string[];
    body: string[];
  }>({ header: [], body: [] });

  // Variable mappings: each variable can be mapped to name/phone/custom
  const [headerMappings, setHeaderMappings] = useState<
    Record<string, VarMapping>
  >({});
  const [bodyMappings, setBodyMappings] = useState<Record<string, VarMapping>>(
    {},
  );

  // Template component data for preview
  const [templateComponents, setTemplateComponents] = useState<any[]>([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5);
  const [toast, setToast] = useState<ToastType>({
    show: false,
    message: "",
    type: "",
  });
  const [isSending, setIsSending] = useState(false);
  const [sendLimit, setSendLimit] = useState<number>(500);

  // -------------------- Helpers --------------------
  const filteredContacts = messageData.contacts.filter(
    (contact) =>
      contact.phone?.includes(searchTerm) ||
      contact.name?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedContacts = filteredContacts.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 4000);
  };

  // Helper to extract parameters {{1}}, {{2}} from text
  const extractParams = (text: string): string[] => {
    const matches = text.match(/{{(\d+)}}/g);
    if (!matches) return [];
    return [...new Set(matches.map((m) => m.replace(/{{|}}/g, "")))].sort();
  };

  const handleTemplateSelect = (id: string) => {
    setSelectedTemplate(id);
    const tpl = templatesList.find((t) => String(t.id) === String(id));

    if (tpl) {
      const components = tpl.components || [];
      setTemplateComponents(components);

      const headerComp = components.find((c: any) => c.type === "HEADER");
      const format = headerComp?.format || "";
      setHeaderFormat(format);

      // Reset upload state
      setHeaderImageUrl("");
      setUploadedFileName("");

      // Extract text params only for TEXT headers
      const headerTextParams =
        format === "TEXT" && headerComp?.text
          ? extractParams(headerComp.text)
          : [];

      const bodyComp = components.find((c: any) => c.type === "BODY");
      const bodyParams = bodyComp ? extractParams(bodyComp.text || "") : [];

      setParsedParams({ header: headerTextParams, body: bodyParams });

      // Initialize mappings
      const newHeaderMappings: Record<string, VarMapping> = {};
      headerTextParams.forEach((p) => {
        newHeaderMappings[p] = { source: "name", customValue: "" };
      });
      setHeaderMappings(newHeaderMappings);

      const newBodyMappings: Record<string, VarMapping> = {};
      bodyParams.forEach((p) => {
        if (p === "1") {
          newBodyMappings[p] = { source: "name", customValue: "" };
        } else {
          newBodyMappings[p] = { source: "custom", customValue: "" };
        }
      });
      setBodyMappings(newBodyMappings);

      setMessageData((prev) => ({
        ...prev,
        templateId: id,
        templateName: tpl.name || "",
        templateLanguage: tpl.language || undefined,
      }));
    }
  };

  // -------------------- Supabase Image Upload --------------------
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      showToast("File too large. Max 10MB allowed.", "error");
      return;
    }

    setIsUploadingImage(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const fileName = `whatsapp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { data, error } = await supabase.storage
        .from("whatsapp-images")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (error) throw error;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("whatsapp-images").getPublicUrl(data.path);

      setHeaderImageUrl(publicUrl);
      setUploadedFileName(file.name);
      showToast("Image uploaded successfully!");
    } catch (err: any) {
      console.error("Upload error:", err);
      showToast(err?.message || "Failed to upload image", "error");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleRemoveImage = () => {
    setHeaderImageUrl("");
    setUploadedFileName("");
  };

  // -------------------- Actions --------------------
  const handleFetchData = async () => {
    const { sheetId, sheetName } = sheetsData;

    if (!sheetId) {
      showToast("Please provide a Google Sheet ID", "error");
      return;
    }

    setIsLoadingContacts(true);
    setContactsError("");

    try {
      const apiUrl = `/api/google-sheets/fetch`;
      const res = await axios.get(apiUrl, {
        params: {
          sheetId: sheetId,
          sheetName: sheetName || "Sheet1",
        },
        timeout: 30000,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      const data = res?.data;
      if (!data.success) {
        throw new Error(data.error || "Failed to fetch data");
      }

      let mapped = data?.data || [];
      setMessageData((prev) => ({ ...prev, contacts: mapped }));
      setSearchTerm("");
      setCurrentPage(1);
      showToast(`Successfully fetched ${mapped.length} contacts`);
    } catch (error: any) {
      console.error("Failed to fetch/parse Google Sheets:", error);
      showToast(
        "Failed to fetch contacts: " +
          (error.response?.data?.error || error.message),
        "error",
      );
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const handleSendMessage = async () => {
    if (isSending) return;

    if (!selectedTemplate) {
      showToast("Please select a template", "error");
      return;
    }

    if (messageData.contacts.length === 0) {
      showToast("No contacts available to send messages", "error");
      return;
    }

    // Validate: if template has IMAGE/VIDEO/DOCUMENT header, image must be uploaded
    if (
      ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat) &&
      !headerImageUrl
    ) {
      showToast(
        `Please upload a ${headerFormat.toLowerCase()} file for the template header`,
        "error",
      );
      return;
    }

    // Validate body custom text vars are filled
    for (const param of parsedParams.body) {
      const mapping = bodyMappings[param];
      if (mapping?.source === "custom" && !mapping.customValue.trim()) {
        showToast(
          `Please fill in Custom Text for body variable {{${param}}}`,
          "error",
        );
        return;
      }
    }

    const effectiveLimit = Math.min(sendLimit, messageData.contacts.length);
    const limitedContacts = messageData.contacts.slice(0, effectiveLimit);

    if (limitedContacts.length === 0) {
      showToast("No contacts to send to", "error");
      return;
    }

    setIsSending(true);
    try {
      // Build components array
      const components: any[] = [];

      // HEADER component
      if (["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat)) {
        // Media header
        const mediaType = headerFormat.toLowerCase(); // "image", "video", "document"
        components.push({
          type: "header",
          parameters: [
            {
              type: mediaType,
              [mediaType]: {
                link: headerImageUrl,
              },
            },
          ],
        });
      } else if (parsedParams.header.length > 0) {
        // Text header with variables
        components.push({
          type: "header",
          parameters: parsedParams.header.map((param) => {
            const mapping = headerMappings[param];
            if (mapping?.source === "custom") {
              return { type: "text", text: mapping.customValue };
            }
            // For name/phone, send placeholder for backend replacement
            return {
              type: "text",
              text: `{{${mapping?.source || "name"}}}`,
            };
          }),
        });
      }

      // BODY component
      if (parsedParams.body.length > 0) {
        components.push({
          type: "body",
          parameters: parsedParams.body.map((param) => {
            const mapping = bodyMappings[param];
            if (mapping?.source === "custom") {
              return { type: "text", text: mapping.customValue };
            }
            // For name/phone, send placeholder for backend replacement
            return {
              type: "text",
              text: `{{${mapping?.source || "name"}}}`,
            };
          }),
        });
      }

      const payload = {
        contacts: limitedContacts,
        templateId: selectedTemplate,
        templateName: messageData.templateName || "",
        templateLanguage: messageData.templateLanguage || "",
        components,
      };

      if (!process.env.NEXT_PUBLIC_BACKEND_URL) {
        showToast("Backend URL not found", "error");
        return;
      }

      const res = await axios(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/messages/template-message`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          data: JSON.stringify(payload),
        },
      );

      if (!res.data.success) {
        showToast(res.data.error, "error");
        return;
      }

      showToast(
        res.data.message ||
          `Successfully queued messages to ${limitedContacts.length} contacts`,
      );
    } catch (error: any) {
      console.error("Send error:", error);
      showToast(error.message || "Failed to send messages", "error");
    } finally {
      setIsSending(false);
    }
  };

  const handleLimitChange = (value: string) => {
    const newLimit = Number(value) || 500;
    setSendLimit(newLimit);
  };

  // -------------------- Template Preview Helpers --------------------
  const getHeaderText = () => {
    const headerComp = templateComponents.find((c: any) => c.type === "HEADER");
    if (!headerComp) return null;
    if (headerComp.format === "TEXT") return headerComp.text;
    return null;
  };

  const getBodyText = () => {
    const bodyComp = templateComponents.find((c: any) => c.type === "BODY");
    return bodyComp?.text || null;
  };

  const getFooterText = () => {
    const footerComp = templateComponents.find((c: any) => c.type === "FOOTER");
    return footerComp?.text || null;
  };

  const getButtons = () => {
    const buttonComp = templateComponents.find(
      (c: any) => c.type === "BUTTONS",
    );
    return buttonComp?.buttons || [];
  };

  // -------------------- JSX --------------------
  return authChecked ? (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            WhatsApp Bulk Messaging
          </h1>
          <p className="text-gray-600">
            Send messages to multiple contacts using Google Sheets integration
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="xl:col-span-2 space-y-6">
            {/* Google Sheets Integration */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center mb-6">
                <Sheet className="w-6 h-6 text-green-600 mr-3" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Google Sheets Integration
                </h2>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Google Sheet ID
                    <span className="text-xs text-gray-500 ml-2">
                      (e.g., 1vGmQBg9NiPKX9rWDPs2o0OKv49FOlA44SS6bNbsuVGk)
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={sheetsData.sheetId}
                      onChange={(e) =>
                        setSheetsData((prev) => ({
                          ...prev,
                          sheetId: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-800"
                      placeholder="Enter Sheet ID"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sheet/Tab Name
                    <span className="text-xs text-gray-500 ml-2">
                      (Leave empty for first sheet)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={sheetsData.sheetName}
                    onChange={(e) =>
                      setSheetsData((prev) => ({
                        ...prev,
                        sheetName: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-800"
                    placeholder="Sheet1"
                  />
                </div>

                <div className="text-xs text-gray-500 mt-2">
                  <p>
                    Make sure your Google Sheet is set to &quot;Anyone with the
                    link can view&quot;.
                  </p>
                </div>
              </div>

              <button
                onClick={handleFetchData}
                disabled={isLoadingContacts || !sheetsData.sheetId}
                className="flex items-center px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoadingContacts ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Fetching Data...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Fetch Data
                  </>
                )}
              </button>

              {contactsError && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                    <span className="text-red-800">{contactsError}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Contacts Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Contacts
                  </h2>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>{filteredContacts.length} contacts</span>
                  </div>
                </div>

                {messageData.contacts.length > 0 && (
                  <div className="mb-4">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by name or phone..."
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>

              {messageData.contacts.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-500">
                  No contacts loaded yet. Use &quot;Fetch Data&quot; above to
                  load from your sheet.
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            #
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Phone Number
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paginatedContacts.map(
                          (contact: Contact, idx: number) => (
                            <tr key={contact.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {startIndex + idx + 1}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {contact.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {contact.phone}
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>

                  {totalPages > 1 && (
                    <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        Showing {startIndex + 1} to{" "}
                        {Math.min(
                          startIndex + itemsPerPage,
                          filteredContacts.length,
                        )}{" "}
                        of {filteredContacts.length} results
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() =>
                            setCurrentPage((prev) => Math.max(prev - 1, 1))
                          }
                          disabled={currentPage === 1}
                          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="px-3 py-1 text-sm font-medium">
                          {currentPage} of {totalPages}
                        </span>
                        <button
                          onClick={() =>
                            setCurrentPage((prev) =>
                              Math.min(prev + 1, totalPages),
                            )
                          }
                          disabled={currentPage === totalPages}
                          className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Template Selection */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center mb-6">
                <Template className="w-6 h-6 text-purple-600 mr-3" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Message Template
                </h2>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Template
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Choose a template...</option>
                  {templatesList.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name} ({template.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Template Preview */}
              {selectedTemplate && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center mb-3">
                    <Eye className="w-4 h-4 text-purple-600 mr-2" />
                    <span className="text-sm font-medium text-purple-800">
                      Template Preview
                    </span>
                  </div>
                  {(() => {
                    const tpl = templatesList.find(
                      (t) => String(t.id) === String(selectedTemplate),
                    );
                    return (
                      <>
                        <div className="text-xs text-purple-600 mb-3">
                          Name: {tpl?.name || messageData.templateName} |
                          Language:{" "}
                          {tpl?.language || messageData.templateLanguage || "-"}{" "}
                          | Status: {tpl?.status || "-"} | Category:{" "}
                          {tpl?.category || "-"}
                        </div>

                        {/* WhatsApp-style preview card */}
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden max-w-sm">
                          {/* Header preview */}
                          {headerFormat === "IMAGE" && (
                            <div className="bg-gray-100 p-6 flex items-center justify-center text-gray-400 text-sm">
                              {headerImageUrl ? (
                                <img
                                  src={headerImageUrl}
                                  alt="Header"
                                  className="max-h-40 rounded object-contain"
                                />
                              ) : (
                                <div className="flex flex-col items-center">
                                  <ImageIcon className="w-8 h-8 mb-1" />
                                  <span>Image Header</span>
                                </div>
                              )}
                            </div>
                          )}
                          {headerFormat === "VIDEO" && (
                            <div className="bg-gray-100 p-6 flex items-center justify-center text-gray-400 text-sm">
                              🎬 Video Header
                            </div>
                          )}
                          {headerFormat === "DOCUMENT" && (
                            <div className="bg-gray-100 p-6 flex items-center justify-center text-gray-400 text-sm">
                              📄 Document Header
                            </div>
                          )}
                          {getHeaderText() && (
                            <div className="px-3 pt-3 font-semibold text-sm text-gray-900">
                              {getHeaderText()}
                            </div>
                          )}

                          {/* Body */}
                          {getBodyText() && (
                            <div className="px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">
                              {getBodyText()}
                            </div>
                          )}

                          {/* Footer */}
                          {getFooterText() && (
                            <div className="px-3 pb-2 text-xs text-gray-400">
                              {getFooterText()}
                            </div>
                          )}

                          {/* Buttons */}
                          {getButtons().length > 0 && (
                            <div className="border-t border-gray-200">
                              {getButtons().map((btn: any, i: number) => (
                                <div
                                  key={i}
                                  className="text-center py-2 text-sm text-blue-600 font-medium border-b border-gray-100 last:border-b-0"
                                >
                                  {btn.text || btn.label || "Button"}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* IMAGE / VIDEO / DOCUMENT Upload */}
              {selectedTemplate &&
                ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat) && (
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h3 className="text-sm font-semibold text-blue-800 mb-3 flex items-center">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload{" "}
                      {headerFormat.charAt(0) +
                        headerFormat.slice(1).toLowerCase()}{" "}
                      for Header
                    </h3>

                    {!headerImageUrl ? (
                      <div>
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-blue-300 border-dashed rounded-lg cursor-pointer bg-white hover:bg-blue-50 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            {isUploadingImage ? (
                              <>
                                <Loader className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                                <p className="text-sm text-blue-600">
                                  Uploading...
                                </p>
                              </>
                            ) : (
                              <>
                                <Upload className="w-8 h-8 text-blue-400 mb-2" />
                                <p className="text-sm text-blue-600">
                                  Click to upload {headerFormat.toLowerCase()}
                                </p>
                                <p className="text-xs text-blue-400 mt-1">
                                  {headerFormat === "IMAGE"
                                    ? "JPG, PNG, GIF, WEBP (max 10MB)"
                                    : headerFormat === "VIDEO"
                                      ? "MP4 (max 10MB)"
                                      : "PDF (max 10MB)"}
                                </p>
                              </>
                            )}
                          </div>
                          <input
                            type="file"
                            className="hidden"
                            accept={
                              headerFormat === "IMAGE"
                                ? "image/jpeg,image/png,image/gif,image/webp"
                                : headerFormat === "VIDEO"
                                  ? "video/mp4"
                                  : "application/pdf"
                            }
                            onChange={handleImageUpload}
                            disabled={isUploadingImage}
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between bg-white p-3 rounded-lg border border-blue-200">
                        <div className="flex items-center min-w-0">
                          <CheckCircle className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-800 truncate">
                              {uploadedFileName}
                            </p>
                            <p className="text-xs text-gray-500 truncate">
                              {headerImageUrl}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={handleRemoveImage}
                          className="ml-3 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded flex-shrink-0"
                          title="Remove"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

              {/* Variable Mapping Inputs */}
              {selectedTemplate &&
                (parsedParams.body.length > 0 ||
                  parsedParams.header.length > 0) && (
                  <div className="mt-6 border-t border-gray-100 pt-6">
                    <h3 className="text-sm font-medium text-gray-900 mb-4">
                      Template Variables
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">
                      Map each variable to a contact field or type custom text
                      that will be the same for all contacts.
                    </p>

                    {/* Header text variables */}
                    {parsedParams.header.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                          Header Variables
                        </h4>
                        {parsedParams.header.map((param) => (
                          <div
                            key={`h-${param}`}
                            className="mb-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {`{{${param}}}`}
                            </label>
                            <select
                              value={headerMappings[param]?.source || "name"}
                              onChange={(e) =>
                                setHeaderMappings((prev) => ({
                                  ...prev,
                                  [param]: {
                                    ...prev[param],
                                    source: e.target.value as any,
                                  },
                                }))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-1"
                            >
                              <option value="name">Contact Name</option>
                              <option value="phone">Phone Number</option>
                              <option value="custom">Custom Text</option>
                            </select>
                            {headerMappings[param]?.source === "custom" && (
                              <input
                                type="text"
                                placeholder="Enter custom text..."
                                value={headerMappings[param]?.customValue || ""}
                                onChange={(e) =>
                                  setHeaderMappings((prev) => ({
                                    ...prev,
                                    [param]: {
                                      ...prev[param],
                                      customValue: e.target.value,
                                    },
                                  }))
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mt-1"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Body variables */}
                    {parsedParams.body.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
                          Body Variables
                        </h4>
                        {parsedParams.body.map((param) => (
                          <div
                            key={`b-${param}`}
                            className="mb-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              {`{{${param}}}`}
                            </label>
                            <select
                              value={bodyMappings[param]?.source || "name"}
                              onChange={(e) =>
                                setBodyMappings((prev) => ({
                                  ...prev,
                                  [param]: {
                                    ...prev[param],
                                    source: e.target.value as any,
                                  },
                                }))
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-1"
                            >
                              <option value="name">Contact Name</option>
                              <option value="phone">Phone Number</option>
                              <option value="custom">Custom Text</option>
                            </select>
                            {bodyMappings[param]?.source === "custom" && (
                              <input
                                type="text"
                                placeholder="Enter custom text..."
                                value={bodyMappings[param]?.customValue || ""}
                                onChange={(e) =>
                                  setBodyMappings((prev) => ({
                                    ...prev,
                                    [param]: {
                                      ...prev[param],
                                      customValue: e.target.value,
                                    },
                                  }))
                                }
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mt-1"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="xl:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-6">
              {/* Current Selection Info */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">
                  Send Configuration
                </h3>

                {/* Contacts Summary */}
                <div className="p-3 rounded-lg border bg-gray-50 border-gray-200 mb-4">
                  <div className="text-sm">
                    <div className="font-medium text-gray-900">
                      Total Contacts: {messageData.contacts.length}
                    </div>
                    <div className="text-gray-600 mt-1">
                      Will send to:{" "}
                      {Math.min(messageData.contacts.length, sendLimit)}{" "}
                      contacts
                    </div>
                  </div>
                </div>

                {/* Template Status */}
                <div
                  className={`p-3 rounded-lg border ${
                    selectedTemplate
                      ? "bg-purple-50 border-purple-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex items-center">
                    <Template
                      className={`w-4 h-4 mr-2 ${
                        selectedTemplate ? "text-purple-600" : "text-gray-400"
                      }`}
                    />
                    <span
                      className={`text-sm font-medium ${
                        selectedTemplate ? "text-purple-800" : "text-gray-600"
                      }`}
                    >
                      {selectedTemplate ? (
                        <>
                          Template:{" "}
                          {messageData.templateName ||
                            templatesList.find(
                              (t) =>
                                String(t.id) === String(messageData.templateId),
                            )?.name ||
                            "-"}
                        </>
                      ) : (
                        "No template selected"
                      )}
                    </span>
                  </div>
                </div>

                {/* Media Status */}
                {selectedTemplate &&
                  ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat) && (
                    <div
                      className={`mt-3 p-3 rounded-lg border ${
                        headerImageUrl
                          ? "bg-green-50 border-green-200"
                          : "bg-amber-50 border-amber-200"
                      }`}
                    >
                      <div className="flex items-center">
                        {headerImageUrl ? (
                          <CheckCircle className="w-4 h-4 mr-2 text-green-600" />
                        ) : (
                          <AlertCircle className="w-4 h-4 mr-2 text-amber-600" />
                        )}
                        <span
                          className={`text-sm font-medium ${
                            headerImageUrl ? "text-green-800" : "text-amber-800"
                          }`}
                        >
                          {headerImageUrl
                            ? `${headerFormat.toLowerCase()} uploaded ✓`
                            : `${headerFormat.toLowerCase()} required`}
                        </span>
                      </div>
                    </div>
                  )}
              </div>

              {/* Send Limit Control */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Send Limit
                </label>
                <select
                  value={sendLimit}
                  onChange={(e) => handleLimitChange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  disabled={messageData.contacts.length === 0}
                >
                  <option value={100}>100 contacts</option>
                  <option value={500}>500 contacts</option>
                  <option value={1000}>1000 contacts</option>
                  <option value={1500}>1500 contacts</option>
                  <option value={2000}>2000 contacts</option>
                  {messageData.contacts.length > 0 &&
                    messageData.contacts.length !== 500 &&
                    messageData.contacts.length !== 1000 &&
                    messageData.contacts.length !== 1500 &&
                    messageData.contacts.length !== 2000 && (
                      <option value={messageData.contacts.length}>
                        All ({messageData.contacts.length} contacts)
                      </option>
                    )}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Limit the number of messages sent in this batch
                </p>
              </div>

              {/* Send Button */}
              <button
                onClick={handleSendMessage}
                disabled={
                  isSending ||
                  messageData.contacts.length === 0 ||
                  !selectedTemplate ||
                  (["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat) &&
                    !headerImageUrl)
                }
                className="w-full flex items-center justify-center px-6 py-4 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg font-medium hover:from-green-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
              >
                {isSending ? (
                  <>
                    <Loader className="w-5 h-5 mr-2 animate-spin" />
                    Sending Messages...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Send to {Math.min(
                      messageData.contacts.length,
                      sendLimit,
                    )}{" "}
                    Contacts
                  </>
                )}
              </button>

              {/* Status Messages */}
              {messageData.contacts.length === 0 && (
                <p className="text-xs text-gray-500 text-center mt-2">
                  Load contacts first
                </p>
              )}
              {messageData.contacts.length > 0 && !selectedTemplate && (
                <p className="text-xs text-amber-600 text-center mt-2">
                  Select a template to enable sending
                </p>
              )}
              {selectedTemplate &&
                ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerFormat) &&
                !headerImageUrl && (
                  <p className="text-xs text-amber-600 text-center mt-2">
                    Upload {headerFormat.toLowerCase()} to enable sending
                  </p>
                )}

              {/* Stats */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Sending Stats
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Messages/Second:</span>
                    <span className="font-medium text-gray-900">10-20</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Est. Time:</span>
                    <span className="font-medium text-gray-900">
                      {Math.ceil(
                        Math.min(messageData.contacts.length, sendLimit) / 15,
                      )}
                      s
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Batch Size:</span>
                    <span className="font-medium text-gray-900">
                      {Math.min(messageData.contacts.length, sendLimit)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-up">
          <div
            className={`flex items-center px-6 py-4 rounded-lg shadow-lg ${
              toast.type === "success"
                ? "bg-green-600 text-white"
                : "bg-red-600 text-white"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle className="w-5 h-5 mr-2" />
            ) : (
              <AlertCircle className="w-5 h-5 mr-2" />
            )}
            <span className="font-medium">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  ) : null;
};

export default page;
