"use client";
import { useGetWhatsappTemplates } from "@/hook/getWhatsapptemp-hook";
import axios from "axios";
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Loader,
  Send,
  Sheet,
  BookTemplate as Template,
  Users,
} from "lucide-react";
import React, { useState } from "react";

// -------------------- Types --------------------
type Contact = {
  id: number;
  name: string;
  phone: string;
};

type TemplateType = {
  id: number;
  name: string;
  category: string;
  language: string;
  status: string;
};

type ToastType = {
  show: boolean;
  message: string;
  type: "success" | "error" | "";
};

type SheetsData = {
  sheetId: string;
  sheetUrl: string;
  sheetName: string;
};

const mockTemplates: TemplateType[] = [
  {
    id: 1,
    name: "Welcome Message",
    category: "MARKETING",
    language: "en",
    status: "APPROVED",
  },
  {
    id: 2,
    name: "Appointment Reminder",
    category: "UTILITY",
    language: "en",
    status: "APPROVED",
  },
  {
    id: 3,
    name: "Promotional Offer",
    category: "MARKETING",
    language: "en",
    status: "APPROVED",
  },
];

type TemplatesType = {
  name: string;
  id: string;
  category: string;
  language: string;
  status: string;
};

const page: React.FC = () => {
  const [sheetsData, setSheetsData] = useState<SheetsData>({
    sheetId: "",
    sheetUrl: "",
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

  const [templates] = useState<TemplateType[]>(mockTemplates);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [isLoadingTemplates] = useState(false);
  const [messageMode, setMessageMode] = useState<"template" | "composer">(
    "template" // Changed default to template since composer is removed
  );

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
      contact.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedContacts = filteredContacts.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  const showToast = (
    message: string,
    type: "success" | "error" = "success"
  ) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "" }), 4000);
  };

  const mapRowsToContacts = (rows: any[]): Contact[] => {
    if (!rows.length) return [];

    const first = rows[0] || {};

    // Fast-path: Apps Script returns objects like { name, number }
    const hasDirectKeys =
      ("name" in first || "Name" in first) &&
      ("number" in first ||
        "Number" in first ||
        "phone" in first ||
        "Phone" in first);
    if (hasDirectKeys) {
      return rows
        .map((row: any, idx: number) => {
          const rawName = row.name ?? row.Name ?? "";
          const rawPhone =
            row.number ?? row.Number ?? row.phone ?? row.Phone ?? "";
          const phone = String(rawPhone ?? "")
            .toString()
            .replace(/[^\d+]/g, "");
          const name =
            String(rawName ?? "")
              .toString()
              .trim() || `Contact ${idx + 1}`;
          if (!phone) return null;
          return { id: idx + 1, name, phone } as Contact;
        })
        .filter(Boolean) as Contact[];
    }

    // Fallback: header-based detection (CSV)
    const headers = Object.keys(first);
    const findHeader = (patterns: RegExp[]): string | undefined =>
      headers.find((header) =>
        patterns.some((pattern) => pattern.test(header))
      );

    const phoneKey = findHeader([
      /phone/i,
      /mobile/i,
      /whats?app/i,
      /number/i,
      /contact/i,
    ]);
    const nameKey = findHeader([
      /^name$/i,
      /full\s*name/i,
      /contact\s*name/i,
      /first\s*name/i,
      /last\s*name/i,
    ]);

    return rows
      .map((row, idx) => {
        const phone = phoneKey
          ? String(row[phoneKey] || "").replace(/[^\d+]/g, "")
          : "";
        const name = nameKey
          ? String(row[nameKey] || "").trim()
          : `Contact ${idx + 1}`;
        if (!phone) return null;
        return { id: idx + 1, name, phone } as Contact;
      })
      .filter(Boolean) as Contact[];
  };

  // -------------------- Actions --------------------
  const handleFetchData = async () => {
    const { sheetId, sheetUrl, sheetName } = sheetsData;

    // Validate inputs
    if (!sheetId && !sheetUrl) {
      showToast("Please provide either a Google Sheet ID or URL", "error");
      return;
    }

    setIsLoadingContacts(true);
    setContactsError("");

    try {
      // Use the sheet URL if provided, otherwise construct it from ID
      const apiUrl = sheetUrl || `YOUR_APPS_SCRIPT_URL`; // You need to add your Apps Script URL here

      const res = await axios.get(apiUrl, {
        params: {
          action: "fetch",
          sheetId: sheetId,
          sheetName: sheetName || "Sheet1",
        },
        timeout: 30000, // 30 second timeout
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });

      const data = res?.data;

      if (!data.success) {
        throw new Error(data.error || "Failed to fetch data");
      }

      let mapped = mapRowsToContacts(data?.data || []);

      setMessageData((prev) => ({ ...prev, contacts: mapped }));
      // Ensure results are visible
      setSearchTerm("");
      setCurrentPage(1);
      showToast(`Successfully fetched ${mapped.length} contacts`);
    } catch (error) {
      console.error("Failed to fetch/parse Google Sheets:", error);
      setContactsError(
        "Failed to fetch data from Google Sheets. Ensure the sheet is public and the Apps Script URL is correct."
      );
      showToast("Failed to fetch contacts", "error");
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const handleSendMessage = async () => {
    if (isSending) return; // prevent duplicate sends

    // Validation checks
    if (!selectedTemplate) {
      showToast("Please select a template", "error");
      return;
    }

    if (messageData.contacts.length === 0) {
      showToast("No contacts available to send messages", "error");
      return;
    }

    // Apply the limit to contacts
    const effectiveLimit = Math.min(sendLimit, messageData.contacts.length);
    const limitedContacts = messageData.contacts.slice(0, effectiveLimit);

    if (limitedContacts.length === 0) {
      showToast("No contacts to send to", "error");
      return;
    }

    setIsSending(true);
    try {
      // Prepare payload with limited contacts
      const payload = {
        contacts: limitedContacts, // This is the key fix - sending limited contacts
        templateId: selectedTemplate,
        templateName: messageData.templateName || "",
        templateLanguage: messageData.templateLanguage || "",
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
        }
      );

      console.log(res.data, "responce form the backend");

      if (!res.data.success) {
        showToast(res.data.error, "error");
        return;
      }

      showToast(
        res.data.message ||
          `Successfully queued messages to ${limitedContacts.length} contacts`
      );

      // Optional: Clear selection after successful send
      // setSelectedTemplate("");
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

  // -------------------- JSX --------------------
  return (
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

                <div className="relative">
                  <div
                    className="absolute inset-0 flex items-center"
                    aria-hidden="true"
                  >
                    <div className="w-full border-t border-gray-300"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">OR</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Apps Script Web App URL
                    <span className="text-xs text-gray-500 ml-2">
                      (Your deployed Apps Script URL)
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={sheetsData.sheetUrl}
                      onChange={(e) =>
                        setSheetsData((prev) => ({
                          ...prev,
                          sheetUrl: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-gray-800"
                      placeholder="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
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
                    Make sure your Google Sheet is set to "Anyone with the link
                    can view".
                  </p>
                </div>
              </div>

              <button
                onClick={handleFetchData}
                disabled={
                  isLoadingContacts ||
                  (!sheetsData.sheetId && !sheetsData.sheetUrl)
                }
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

                {/* Search Box */}
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
                  No contacts loaded yet. Use "Fetch Data" above to load from
                  your sheet.
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
                          )
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
                      <div className="text-sm text-gray-700">
                        Showing {startIndex + 1} to{" "}
                        {Math.min(
                          startIndex + itemsPerPage,
                          filteredContacts.length
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
                              Math.min(prev + 1, totalPages)
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
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedTemplate(id);
                    const tpl = templatesList.find(
                      (t) => String(t.id) === String(id)
                    );
                    setMessageData((prev) => ({
                      ...prev,
                      templateId: id,
                      templateName: tpl?.name || "",
                      templateLanguage: tpl?.language || undefined,
                    }));
                  }}
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

              {selectedTemplate && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center mb-2">
                    <Eye className="w-4 h-4 text-purple-600 mr-2" />
                    <span className="text-sm font-medium text-purple-800">
                      Template Preview
                    </span>
                  </div>
                  {(() => {
                    const tpl = templatesList.find(
                      (t) => String(t.id) === String(selectedTemplate)
                    );
                    return (
                      <>
                        <p className="text-sm text-purple-700">
                          {tpl?.name || messageData.templateName} will be used.
                        </p>
                        <div className="mt-2 text-xs text-purple-600">
                          Language:{" "}
                          {tpl?.language || messageData.templateLanguage || "-"}{" "}
                          | Status: {tpl?.status || "-"} | Category:{" "}
                          {tpl?.category || "-"}
                        </div>
                      </>
                    );
                  })()}
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
                                String(t.id) === String(messageData.templateId)
                            )?.name ||
                            "-"}
                        </>
                      ) : (
                        "No template selected"
                      )}
                    </span>
                  </div>
                </div>
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
                  !selectedTemplate
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
                      sendLimit
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
                        Math.min(messageData.contacts.length, sendLimit) / 15
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
  );
};

export default page;
