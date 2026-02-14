import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import Papa from "papaparse";

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const sheetId = searchParams.get("sheetId");
    const sheetName = searchParams.get("sheetName");

    if (!sheetId) {
      return NextResponse.json(
        { success: false, error: "Sheet ID is required" },
        { status: 400 },
      );
    }

    // Construct the public CSV export URL
    // https://docs.google.com/spreadsheets/d/{sheetId}/gviz/tq?tqx=out:csv&sheet={sheetName}
    let url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv`;
    if (sheetName) {
      url += `&sheet=${encodeURIComponent(sheetName)}`;
    }

    console.log(`Fetching Google Sheet CSV from: ${url}`);

    const response = await axios.get(url, {
      responseType: "text",
      validateStatus: (status) => status < 500, // Handle 4xx errors manually
    });

    if (response.status !== 200) {
      console.error(`Google Sheets API returned status ${response.status}`);
      return NextResponse.json(
        {
          success: false,
          error:
            "Failed to fetch sheet. Ensure the sheet is 'Anyone with the link' and the Sheet Name is correct.",
        },
        { status: 400 },
      );
    }

    const csvText = response.data;

    if (!csvText) {
      return NextResponse.json(
        { success: false, error: "Empty response from Google Sheets" },
        { status: 400 },
      );
    }

    // Parse CSV
    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(), // Trim headers to avoid key mismatches
    });

    if (parsed.errors.length > 0) {
      console.warn("CSV Parsing errors:", parsed.errors);
    }

    const rows = parsed.data as Record<string, string>[];

    // Filtering Logic
    // matching "Name" (or similar) and "Phone"/"Mobile" (or similar).

    // Heuristic patterns for headers
    const namePatterns = [
      /^name$/i,
      /full\s*name/i,
      /contact\s*name/i,
      /first\s*name/i,
      /last\s*name/i,
    ];
    const phonePatterns = [
      /phone/i,
      /mobile/i,
      /whats?app/i,
      /number/i,
      /contact/i,
    ];

    if (rows.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const headers = Object.keys(rows[0]);

    const findHeader = (patterns: RegExp[]): string | undefined =>
      headers.find((header) =>
        patterns.some((pattern) => pattern.test(header)),
      );

    const nameKey = findHeader(namePatterns);
    const phoneKey = findHeader(phonePatterns);

    if (!phoneKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Could not find a 'Phone' or 'Mobile' column in the sheet.",
        },
        { status: 400 },
      );
    }

    const filteredData = rows
      .map((row, idx) => {
        const rawPhone = row[phoneKey];
        // Basic cleaning
        const phone = String(rawPhone || "").replace(/[^\d+]/g, "");

        const name = nameKey
          ? row[nameKey] || `Contact ${idx + 1}`
          : `Contact ${idx + 1}`;

        if (!phone) return null;

        return {
          name: name.trim(),
          phone: phone,
        };
      })
      .filter(Boolean);

    return NextResponse.json({
      success: true,
      data: filteredData,
    });
  } catch (error: any) {
    console.error("Error fetching Google Sheet:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Internal Server Error" },
      { status: 500 },
    );
  }
}
