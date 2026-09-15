import { google } from "googleapis";

// ======================================================
// KONFIGURASI GOOGLE SHEETS
// ======================================================

const SHEETS = {
  sppbj: {
    name: "SPPBJ",
    range: "A:U",
    headerIndex: 3, // Baris 4
  },

  prosesTender: {
    name: "Proses Tender",
    range: "A:U",
    headerIndex: 3, // Baris 4
  },

  config: {
    name: "Config",
    range: "A:U",
    headerIndex: 3, // Baris 4
  },

  kembali: {
    name: "Kembali",
    range: "A:U",
    headerIndex: 3, // Baris 4
  },

  rupa: {
    name: "Rupa",
    range: "A:L",
    headerIndex: 0, // Baris 1
  },
};

// ======================================================
// GOOGLE AUTHENTICATION
// ======================================================

function getGoogleAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email) {
    throw new Error("Environment Variable GOOGLE_SERVICE_ACCOUNT_EMAIL belum tersedia.");
  }

  if (!privateKey) {
    throw new Error("Environment Variable GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY belum tersedia.");
  }

  return new google.auth.JWT({
    email,
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

// ======================================================
// NORMALIZE HEADER
// ======================================================

function normalizeHeader(value) {
  return String(value ?? "")
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// ======================================================
// GET FIELD DENGAN BEBERAPA ALIAS
// ======================================================

function getField(row, aliases) {
  const keys = Object.keys(row);

  for (const alias of aliases) {
    const normalizedAlias = normalizeHeader(alias);

    const foundKey = keys.find((key) => {
      return normalizeHeader(key) === normalizedAlias;
    });

    if (foundKey !== undefined) {
      return row[foundKey] ?? "";
    }
  }

  return "";
}

// ======================================================
// READ GOOGLE SHEET
// ======================================================

async function readSheet(sheetsApi, sheetName, range, headerIndex) {
  console.log("------------------------------------------");
  console.log(`Membaca Sheet: ${sheetName}`);
  console.log(`Range: ${range}`);
  console.log(`Header Index: ${headerIndex}`);

  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: `${sheetName}!${range}`,
    valueRenderOption: "FORMATTED_VALUE",
  });

  const rows = response.data.values || [];

  console.log(`Sheet ${sheetName}: ${rows.length} baris diterima`);

  if (rows.length <= headerIndex) {
    console.log(`Sheet ${sheetName} tidak mempunyai data yang cukup.`);

    return [];
  }

  // --------------------------------------------------
  // HEADER
  // --------------------------------------------------

  const headers = rows[headerIndex].map((header) => String(header || "").trim());

  console.log(`Header ${sheetName}:`, headers);

  // --------------------------------------------------
  // DATA
  // --------------------------------------------------

  const dataRows = rows.slice(headerIndex + 1);

  const result = dataRows
    .filter((row) => {
      return row.some((value) => String(value || "").trim() !== "");
    })
    .map((row, index) => {
      const obj = {
        _row: headerIndex + index + 2,
      };

      headers.forEach((header, columnIndex) => {
        if (!header) {
          return;
        }

        obj[header] = row[columnIndex] !== undefined ? row[columnIndex] : "";
      });

      return obj;
    });

  console.log(`Sheet ${sheetName}: ${result.length} data valid`);

  // --------------------------------------------------
  // DEBUG SAMPLE
  // --------------------------------------------------

  if (result.length > 0) {
    console.log(`Contoh data ${sheetName}:`, result[0]);
  }

  return result;
}

// ======================================================
// NORMALIZE PROCUREMENT
// ======================================================

function normalizeProcurement(rows, source) {
  return rows.map((row) => ({
    source,

    no: getField(row, ["No", "NO"]),

    nomorPaket: getField(row, ["No. Paket Pekerjaan (PK)", "No Paket Pekerjaan (PK)", "No Paket Pekerjaan", "Nomor Paket Pekerjaan", "Nomor Paket"]),

    uraianPekerjaan: getField(row, ["Uraian Pekerjaan", "Uraian pekerjaan", "Judul Pekerjaan"]),

    bagian: getField(row, ["Bagian"]),

    nilaiHPS: getField(row, ["Nilai HPS (Rp)", "Nilai HPS", "HPS"]),

    jenisPengadaan: getField(row, ["Jenis Pengadaan", "Jenis"]),

    metodePemilihan: getField(row, ["Metode Pemilihan", "Metode Pemilihan yang digunakan"]),

    vendor: getField(row, ["Vendor yg disarankan", "Vendor yang disarankan", "Vendor"]),

    keterangan: getField(row, ["Keterangan"]),

    pic: getField(row, ["PIC"]),

    tim: getField(row, ["Tim/TIM", "Tim", "TIM"]),

    dokumenPengadaan: getField(row, ["Dokumen Pengadaan"]),

    progress: getField(row, ["Progress", "Progres"]),

    tenderUlang1: getField(row, ["Tender Ulang I"]),

    tenderUlang2: getField(row, ["Tender Ulang II"]),

    tenderUlang3: getField(row, ["Tender Ulang III"]),

    tenderUlang4: getField(row, ["Tender Ulang IV"]),

    kembaliHps: getField(row, ["Kembali ke HPS / Teknis", "Kembali ke HPS/Teknis"]),

    nilaiAnggaran: getField(row, ["Nilai Anggaran / PPAB", "Nilai Anggaran / PAB", "Nilai Anggaran", "PPAB", "PAB"]),

    noRup: getField(row, ["No RUP", "No. RUP", "Nomor RUP"]),
  }));
}

// ======================================================
// NORMALIZE RUPA
// ======================================================

function normalizeRupa(rows) {
  return rows.map((row) => ({
    no: getField(row, ["NO", "No"]),

    nomorRupa: getField(row, ["Nomor RUPA", "No RUPA", "No. RUPA"]),

    judulPekerjaan: getField(row, ["Judul Pekerjaan", "Uraian Pekerjaan"]),

    bulan: getField(row, ["Rencana Waktu Pelaksanaan — Bulan", "Rencana Waktu Pelaksanaan - Bulan", "Rencana Waktu Pelaksanaan – Bulan", "Rencana Waktu Pelaksanaan", "Bulan"]),

    tahun: getField(row, ["Tahun"]),

    jenisPengadaan: getField(row, ["Jenis Pengadaan", "Jenis"]),

    estimasiNilai: getField(row, ["Estimasi Nilai Pekerjaan", "Estimasi Nilai"]),

    metodePemilihan: getField(row, ["Metode Pemilihan yang digunakan", "Metode Pemilihan Yang digunakan", "Metode Pemilihan"]),

    rencanaCapaian: getField(row, ["Rencana Capaian Produk"]),

    sumberAnggaran: getField(row, ["Sumber Anggaran"]),

    keterangan: getField(row, ["Keterangan"]),

    bagian: getField(row, ["Bagian"]),
  }));
}

// ======================================================
// MAIN NETLIFY FUNCTION
// ======================================================

export default async () => {
  try {
    console.log("==========================================");
    console.log("GET-DATA FUNCTION START");
    console.log("==========================================");

    // --------------------------------------------------
    // CHECK ENVIRONMENT VARIABLES
    // --------------------------------------------------

    console.log("GOOGLE_SHEET_ID:", process.env.GOOGLE_SHEET_ID ? "TERSEDIA" : "TIDAK TERSEDIA");

    console.log("GOOGLE_SERVICE_ACCOUNT_EMAIL:", process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? "TERSEDIA" : "TIDAK TERSEDIA");

    console.log("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:", process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ? "TERSEDIA" : "TIDAK TERSEDIA");

    if (!process.env.GOOGLE_SHEET_ID) {
      throw new Error("GOOGLE_SHEET_ID belum dikonfigurasi.");
    }

    // --------------------------------------------------
    // GOOGLE AUTH
    // --------------------------------------------------

    console.log("Membuat Google Authentication...");

    const auth = getGoogleAuth();

    console.log("Google Authentication berhasil.");

    // --------------------------------------------------
    // GOOGLE SHEETS API
    // --------------------------------------------------

    const sheets = google.sheets({
      version: "v4",
      auth,
    });

    console.log("Google Sheets API berhasil dibuat.");

    // --------------------------------------------------
    // READ ALL SHEETS
    // --------------------------------------------------

    const [sppbjRows, prosesTenderRows, configRows, kembaliRows, rupaRows] = await Promise.all([
      readSheet(sheets, SHEETS.sppbj.name, SHEETS.sppbj.range, SHEETS.sppbj.headerIndex),

      readSheet(sheets, SHEETS.prosesTender.name, SHEETS.prosesTender.range, SHEETS.prosesTender.headerIndex),

      readSheet(sheets, SHEETS.config.name, SHEETS.config.range, SHEETS.config.headerIndex),

      readSheet(sheets, SHEETS.kembali.name, SHEETS.kembali.range, SHEETS.kembali.headerIndex),

      readSheet(sheets, SHEETS.rupa.name, SHEETS.rupa.range, SHEETS.rupa.headerIndex),
    ]);

    // --------------------------------------------------
    // NORMALIZE
    // --------------------------------------------------

    console.log("Melakukan normalisasi data...");

    const data = {
      sppbj: normalizeProcurement(sppbjRows, "SPPBJ"),

      prosesTender: normalizeProcurement(prosesTenderRows, "Proses Tender"),

      config: normalizeProcurement(configRows, "Config"),

      kembali: normalizeProcurement(kembaliRows, "Kembali"),

      rupa: normalizeRupa(rupaRows),
    };

    // --------------------------------------------------
    // LOG RESULT
    // --------------------------------------------------

    console.log("==========================================");
    console.log("HASIL PENGAMBILAN DATA");
    console.log("SPPBJ:", data.sppbj.length);
    console.log("Proses Tender:", data.prosesTender.length);
    console.log("Config:", data.config.length);
    console.log("Kembali:", data.kembali.length);
    console.log("Rupa:", data.rupa.length);
    console.log("==========================================");

    // --------------------------------------------------
    // SUCCESS RESPONSE
    // --------------------------------------------------

    return new Response(
      JSON.stringify({
        success: true,

        data,

        meta: {
          sppbj: data.sppbj.length,
          prosesTender: data.prosesTender.length,
          config: data.config.length,
          kembali: data.kembali.length,
          rupa: data.rupa.length,
          fetchedAt: new Date().toISOString(),
        },
      }),
      {
        status: 200,

        headers: {
          "Content-Type": "application/json",

          "Cache-Control": "private, no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    console.error("==========================================");

    console.error("GET-DATA FUNCTION ERROR");

    console.error("==========================================");

    console.error("Error name:", error?.name);

    console.error("Error message:", error?.message);

    console.error("Error code:", error?.code);

    console.error("Error status:", error?.response?.status);

    console.error("Error details:", error?.response?.data);

    console.error("Stack:", error?.stack);

    return new Response(
      JSON.stringify({
        success: false,

        error: "Server Error",

        message: error?.message || "Terjadi kesalahan pada server.",
      }),
      {
        status: 500,

        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};
