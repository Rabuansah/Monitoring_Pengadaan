import { google } from "googleapis";
// import { getUser } from "@netlify/identity";

// ======================================================
// KONFIGURASI GOOGLE SHEETS
// ======================================================

const SHEETS = {
  sppbj: {
    name: "SPPBJ",
    range: "A:U",
    headerIndex: 3,
  },

  prosesTender: {
    name: "Proses Tender",
    range: "A:U",
    headerIndex: 3,
  },

  config: {
    name: "Config",
    range: "A:U",
    headerIndex: 3,
  },

  kembali: {
    name: "Kembali",
    range: "A:U",
    headerIndex: 3,
  },

  rupa: {
    name: "Rupa",
    range: "A:L",
    headerIndex: 1,
  },
};

// ======================================================
// GOOGLE AUTHENTICATION
// ======================================================

function getGoogleAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;

  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  // ------------------------------------------
  // CHECK EMAIL
  // ------------------------------------------

  if (!email) {
    throw new Error("Environment Variable GOOGLE_SERVICE_ACCOUNT_EMAIL belum tersedia.");
  }

  // ------------------------------------------
  // CHECK PRIVATE KEY
  // ------------------------------------------

  if (!privateKey) {
    throw new Error("Environment Variable GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY belum tersedia.");
  }

  // ------------------------------------------
  // CREATE JWT
  // ------------------------------------------

  return new google.auth.JWT({
    email: email,

    key: privateKey.replace(/\\n/g, "\n"),

    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

// ======================================================
// READ GOOGLE SHEET
// ======================================================

async function readSheet(sheetsApi, sheetName, range, headerIndex) {
  console.log(`Membaca Sheet: ${sheetName}`);

  console.log(`Range: ${range}`);

  console.log(`Header Index: ${headerIndex}`);

  // ------------------------------------------
  // REQUEST GOOGLE SHEETS
  // ------------------------------------------

  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,

    range: `${sheetName}!${range}`,

    valueRenderOption: "FORMATTED_VALUE",
  });

  const rows = response.data.values || [];

  console.log(`Sheet ${sheetName}: ${rows.length} baris diterima`);

  // ------------------------------------------
  // CHECK DATA
  // ------------------------------------------

  if (rows.length <= headerIndex) {
    console.log(`Sheet ${sheetName} tidak mempunyai data yang cukup.`);

    return [];
  }

  // ------------------------------------------
  // HEADER
  // ------------------------------------------

  const headers = rows[headerIndex].map((header) => String(header || "").trim());

  console.log(`Header ${sheetName}:`, headers);

  // ------------------------------------------
  // DATA
  // ------------------------------------------

  const dataRows = rows.slice(headerIndex + 1);

  // ------------------------------------------
  // CONVERT ROW → OBJECT
  // ------------------------------------------

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

  return result;
}

// ======================================================
// NORMALIZE PROCUREMENT
// ======================================================

function normalizeProcurement(rows, source) {
  return rows.map((row) => ({
    source,

    no: row["No"] || "",

    nomorPaket: row["No. Paket Pekerjaan (PK)"] || row["No Paket Pekerjaan (PK)"] || row["No Paket Pekerjaan"] || "",

    uraianPekerjaan: row["Uraian Pekerjaan"] || "",

    bagian: row["Bagian"] || "",

    nilaiHPS: row["Nilai HPS (Rp)"] || "",

    jenisPengadaan: row["Jenis Pengadaan"] || "",

    metodePemilihan: row["Metode Pemilihan"] || "",

    vendor: row["Vendor yg disarankan"] || row["Vendor yang disarankan"] || "",

    keterangan: row["Keterangan"] || "",

    pic: row["PIC"] || "",

    tim: row["Tim/TIM"] || row["Tim"] || "",

    dokumenPengadaan: row["Dokumen Pengadaan"] || "",

    progress: row["Progress"] || "",

    tenderUlang1: row["Tender Ulang I"] || "",

    tenderUlang2: row["Tender Ulang II"] || "",

    tenderUlang3: row["Tender Ulang III"] || "",

    tenderUlang4: row["Tender Ulang IV"] || "",

    kembaliHps: row["Kembali ke HPS / Teknis"] || row["Kembali ke HPS/Teknis"] || "",

    nilaiAnggaran: row["Nilai Anggaran / PPAB"] || row["Nilai Anggaran / PAB"] || "",

    noRup: row["No RUP"] || "",
  }));
}

// ======================================================
// NORMALIZE RUPA
// ======================================================

function normalizeRupa(rows) {
  return rows.map((row) => ({
    no: row["NO"] || row["No"] || "",

    nomorRupa: row["Nomor RUPA"] || "",

    judulPekerjaan: row["Judul Pekerjaan"] || "",

    bulan: row["Rencana Waktu Pelaksanaan — Bulan"] || row["Rencana Waktu Pelaksanaan - Bulan"] || row["Rencana Waktu Pelaksanaan – Bulan"] || "",

    tahun: row["Tahun"] || "",

    jenisPengadaan: row["Jenis Pengadaan"] || "",

    estimasiNilai: row["Estimasi Nilai Pekerjaan"] || "",

    metodePemilihan: row["Metode Pemilihan yang digunakan"] || row["Metode Pemilihan Yang digunakan"] || "",

    rencanaCapaian: row["Rencana Capaian Produk"] || "",

    sumberAnggaran: row["Sumber Anggaran"] || "",

    keterangan: row["Keterangan"] || "",

    bagian: row["Bagian"] || "",
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

    // ==================================================
    // 1. CHECK ENVIRONMENT VARIABLES
    // ==================================================

    console.log("GOOGLE_SHEET_ID:", process.env.GOOGLE_SHEET_ID ? "TERSEDIA" : "TIDAK TERSEDIA");

    console.log("GOOGLE_SERVICE_ACCOUNT_EMAIL:", process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? "TERSEDIA" : "TIDAK TERSEDIA");

    console.log("GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY:", process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ? "TERSEDIA" : "TIDAK TERSEDIA");

    if (!process.env.GOOGLE_SHEET_ID) {
      throw new Error("GOOGLE_SHEET_ID belum dikonfigurasi.");
    }

    // ==================================================
    // 2. CHECK USER LOGIN
    // ==================================================

    // const user = await getUser();

    // console.log("User:", user ? user.email : "TIDAK LOGIN");

    // if (!user) {
    //   return new Response(
    //     JSON.stringify({
    //       success: false,

    //       error: "Unauthorized",

    //       message: "User belum login ke Netlify Identity.",
    //     }),

    //     {
    //       status: 401,

    //       headers: {
    //         "Content-Type": "application/json",
    //       },
    //     },
    //   );
    // }

    // ==================================================
    // 3. CREATE GOOGLE AUTH
    // ==================================================

    console.log("Membuat Google Authentication...");

    const auth = getGoogleAuth();

    console.log("Google Authentication berhasil.");

    // ==================================================
    // 4. CREATE SHEETS API
    // ==================================================

    const sheets = google.sheets({
      version: "v4",

      auth,
    });

    console.log("Google Sheets API berhasil dibuat.");

    // ==================================================
    // 5. TEST AUTHENTICATION
    // ==================================================

    console.log("Melakukan koneksi ke Google Sheets...");

    /*
     * Kita membaca kelima sheet secara paralel.
     * Jika salah satu gagal, error akan ditampilkan
     * pada log Netlify.
     */

    const [sppbjRows, prosesTenderRows, configRows, kembaliRows, rupaRows] = await Promise.all([
      // ------------------------------------------
      // SPPBJ
      // ------------------------------------------

      readSheet(
        sheets,

        SHEETS.sppbj.name,

        SHEETS.sppbj.range,

        SHEETS.sppbj.headerIndex,
      ),

      // ------------------------------------------
      // PROSES TENDER
      // ------------------------------------------

      readSheet(
        sheets,

        SHEETS.prosesTender.name,

        SHEETS.prosesTender.range,

        SHEETS.prosesTender.headerIndex,
      ),

      // ------------------------------------------
      // CONFIG
      // ------------------------------------------

      readSheet(
        sheets,

        SHEETS.config.name,

        SHEETS.config.range,

        SHEETS.config.headerIndex,
      ),

      // ------------------------------------------
      // KEMBALI
      // ------------------------------------------

      readSheet(
        sheets,

        SHEETS.kembali.name,

        SHEETS.kembali.range,

        SHEETS.kembali.headerIndex,
      ),

      // ------------------------------------------
      // RUPA
      // ------------------------------------------

      readSheet(
        sheets,

        SHEETS.rupa.name,

        SHEETS.rupa.range,

        SHEETS.rupa.headerIndex,
      ),
    ]);

    // ==================================================
    // 6. NORMALIZE DATA
    // ==================================================

    console.log("Melakukan normalisasi data...");

    const data = {
      sppbj: normalizeProcurement(sppbjRows, "SPPBJ"),

      prosesTender: normalizeProcurement(prosesTenderRows, "Proses Tender"),

      config: normalizeProcurement(configRows, "Config"),

      kembali: normalizeProcurement(kembaliRows, "Kembali"),

      rupa: normalizeRupa(rupaRows),
    };

    // ==================================================
    // 7. LOG TOTAL DATA
    // ==================================================

    console.log("==========================================");

    console.log("HASIL PENGAMBILAN DATA");

    console.log("SPPBJ:", data.sppbj.length);

    console.log("Proses Tender:", data.prosesTender.length);

    console.log("Config:", data.config.length);

    console.log("Kembali:", data.kembali.length);

    console.log("Rupa:", data.rupa.length);

    console.log("==========================================");

    // ==================================================
    // 8. SUCCESS RESPONSE
    // ==================================================

    return new Response(
      JSON.stringify({
        success: true,

        // user: {
        //   email: user.email,
        // },

        data: data,

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
    // ==================================================
    // ERROR HANDLING
    // ==================================================

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
