/* =========================================================
   GLOBAL STATE
   ========================================================= */

const STATE = {
  data: {
    sppbj: [],
    prosesTender: [],
    config: [],
    kembali: [],
    rupa: [],
  },

  filteredProcurement: [],

  charts: {
    procurement: null,
    status: null,
  },

  currentPage: "dashboard",
};

/* =========================================================
   DOM HELPER
   ========================================================= */

function $(selector) {
  return document.querySelector(selector);
}

/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  initializeEvents();

  if (window.lucide) {
    lucide.createIcons();
  }

  loadData();
});

/* =========================================================
   EVENTS
   ========================================================= */

function initializeEvents() {
  // Retry
  $("#retryButton")?.addEventListener("click", loadData);

  // Refresh
  $("#refreshDataButton")?.addEventListener("click", loadData);

  // Filter Bagian
  $("#filterBagian")?.addEventListener("change", applyFilters);

  // Filter Jenis
  $("#filterJenis")?.addEventListener("change", applyFilters);

  // Navigation
  document.querySelectorAll("[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      const page = button.dataset.page;

      navigateTo(page);
    });
  });

  // Mobile menu
  $("#mobileMenuButton")?.addEventListener("click", openSidebar);

  $("#sidebarOverlay")?.addEventListener("click", closeSidebar);

  // Export
  $("#exportDashboardButton")?.addEventListener("click", exportDashboard);

  $("#exportRupaButton")?.addEventListener("click", exportRupa);
}

/* =========================================================
   LOAD DATA
   ========================================================= */

async function loadData() {
  showLoading();

  try {
    const response = await fetch("/.netlify/functions/get-data", {
      method: "GET",

      credentials: "include",

      cache: "no-store",

      headers: {
        Accept: "application/json",
      },
    });

    if (response.status === 404) {
      throw new Error("Function get-data tidak ditemukan. Periksa folder netlify/functions dan konfigurasi Netlify.");
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || `Server mengembalikan HTTP ${response.status}.`);
    }

    if (!result.success) {
      throw new Error(result.message || "Server tidak mengembalikan data yang valid.");
    }

    STATE.data = normalizeResponseData(result.data);

    updateLastUpdate(result.meta?.fetchedAt);

    populateFilters();

    applyFilters();

    renderRupa();

    renderReports();

    showApp();
  } catch (error) {
    console.error("LOAD DATA ERROR:", error);

    showError(error.message || "Terjadi kesalahan saat mengambil data.");
  }
}

/* =========================================================
   NORMALIZE RESPONSE
   ========================================================= */

function normalizeResponseData(data) {
  return {
    sppbj: Array.isArray(data?.sppbj) ? data.sppbj : [],

    prosesTender: Array.isArray(data?.prosesTender) ? data.prosesTender : [],

    config: Array.isArray(data?.config) ? data.config : [],

    kembali: Array.isArray(data?.kembali) ? data.kembali : [],

    rupa: Array.isArray(data?.rupa) ? data.rupa : [],
  };
}

/* =========================================================
   GET ALL PROCUREMENT DATA
   ========================================================= */

function getAllProcurement() {
  const sources = [...STATE.data.sppbj, ...STATE.data.prosesTender, ...STATE.data.config, ...STATE.data.kembali];

  return sources;
}

/* =========================================================
   FILTER OPTIONS
   ========================================================= */

function populateFilters() {
  const procurement = getAllProcurement();

  const bagianSet = new Set();

  const jenisSet = new Set();

  procurement.forEach((item) => {
    const bagian = String(item.bagian || "").trim();

    const jenis = String(item.jenisPengadaan || "").trim();

    if (bagian) {
      bagianSet.add(bagian);
    }

    if (jenis) {
      jenisSet.add(jenis);
    }
  });

  const bagianSelect = $("#filterBagian");

  const jenisSelect = $("#filterJenis");

  const currentBagian = bagianSelect.value;

  const currentJenis = jenisSelect.value;

  bagianSelect.innerHTML = `<option value="">Semua Bagian</option>`;

  jenisSelect.innerHTML = `<option value="">Semua Jenis</option>`;

  [...bagianSet].sort().forEach((value) => {
    const option = document.createElement("option");

    option.value = value;

    option.textContent = value;

    bagianSelect.appendChild(option);
  });

  [...jenisSet].sort().forEach((value) => {
    const option = document.createElement("option");

    option.value = value;

    option.textContent = value;

    jenisSelect.appendChild(option);
  });

  bagianSelect.value = currentBagian;

  jenisSelect.value = currentJenis;
}

/* =========================================================
   APPLY FILTER
   ========================================================= */

function applyFilters() {
  const bagian = $("#filterBagian").value;

  const jenis = $("#filterJenis").value;

  let data = getAllProcurement();

  if (bagian) {
    data = data.filter((item) => String(item.bagian || "").trim() === bagian);
  }

  if (jenis) {
    data = data.filter((item) => String(item.jenisPengadaan || "").trim() === jenis);
  }

  STATE.filteredProcurement = data;

  renderDashboard();
}

/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {
  const data = STATE.filteredProcurement;

  updateScorecards(data);

  renderDashboardTable(data);

  renderProcurementChart(data);

  renderStatusChart(data);

  updateTableSummary(data.length);
}

/* =========================================================
   SCORECARDS
   ========================================================= */

function updateScorecards(data) {
  const total = data.length;

  const tender = data.filter((item) => isTender(item.metodePemilihan)).length;

  const pl = data.filter((item) => isPL(item.metodePemilihan)).length;

  const sppbj = STATE.data.sppbj.length;

  const proses = STATE.data.prosesTender.length;

  const config = STATE.data.config.length;

  const gagal = data.filter((item) => isFailedOrReturned(item.progress)).length;

  const rupa = STATE.data.rupa.length;

  setText("#totalPaket", formatNumber(total));

  setText("#totalTender", formatNumber(tender));

  setText("#totalPL", formatNumber(pl));

  setText("#totalSPPBJ", formatNumber(sppbj));

  setText("#totalProses", formatNumber(proses));

  setText("#totalConfig", formatNumber(config));

  setText("#totalGagal", formatNumber(gagal));

  setText("#totalRupa", formatNumber(rupa));
}

/* =========================================================
   PROCUREMENT TYPE
   ========================================================= */

function isTender(value) {
  return String(value || "")
    .toLowerCase()
    .includes("tender");
}

function isPL(value) {
  const text = String(value || "").toLowerCase();

  return text.includes("penunjukan langsung") || text === "pl";
}

/* =========================================================
   FAILED / RETURNED
   ========================================================= */

function isFailedOrReturned(value) {
  const text = String(value || "").toLowerCase();

  return text.includes("gagal") || text.includes("kembali") || text.includes("dikembalikan");
}

/* =========================================================
   DASHBOARD TABLE
   ========================================================= */

function renderDashboardTable(data) {
  const tbody = $("#dashboardTableBody");

  if (!data.length) {
    tbody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-table">
                    Tidak ada data yang sesuai dengan filter.
                </td>
            </tr>
        `;

    return;
  }

  const maxRows = 100;

  tbody.innerHTML = data
    .slice(0, maxRows)
    .map((item, index) => {
      return `
                    <tr>

                        <td>
                            ${index + 1}
                        </td>

                        <td class="font-semibold text-slate-700">
                            ${escapeHtml(item.nomorPaket || "-")}
                        </td>

                        <td>
                            <div class="max-w-xs truncate"
                                 title="${escapeAttribute(item.uraianPekerjaan || "")}">
                                ${escapeHtml(item.uraianPekerjaan || "-")}
                            </div>
                        </td>

                        <td>
                            ${escapeHtml(item.bagian || "-")}
                        </td>

                        <td>
                            ${escapeHtml(item.jenisPengadaan || "-")}
                        </td>

                        <td>
                            ${escapeHtml(item.metodePemilihan || "-")}
                        </td>

                        <td class="whitespace-nowrap">
                            ${formatRupiah(item.nilaiHPS)}
                        </td>

                        <td>
                            ${createStatusBadge(item.progress)}
                        </td>

                    </tr>
                `;
    })
    .join("");
}

/* =========================================================
   STATUS BADGE
   ========================================================= */

function createStatusBadge(status) {
  const value = String(status || "-").trim();

  const lower = value.toLowerCase();

  let classes = "bg-slate-100 text-slate-600";

  if (lower.includes("selesai") || lower.includes("sppbj")) {
    classes = "bg-emerald-100 text-emerald-700";
  } else if (lower.includes("gagal")) {
    classes = "bg-red-100 text-red-700";
  } else if (lower.includes("config")) {
    classes = "bg-purple-100 text-purple-700";
  } else if (lower.includes("tender")) {
    classes = "bg-blue-100 text-blue-700";
  } else if (lower.includes("kembali")) {
    classes = "bg-amber-100 text-amber-700";
  }

  return `
        <span class="status-badge ${classes}">
            ${escapeHtml(value)}
        </span>
    `;
}

/* =========================================================
   PROCUREMENT CHART
   ========================================================= */

function renderProcurementChart(data) {
  const canvas = $("#procurementChart");

  if (!canvas) {
    return;
  }

  const tender = data.filter((item) => isTender(item.metodePemilihan)).length;

  const pl = data.filter((item) => isPL(item.metodePemilihan)).length;

  if (STATE.charts.procurement) {
    STATE.charts.procurement.destroy();
  }

  STATE.charts.procurement = new Chart(canvas, {
    type: "doughnut",

    data: {
      labels: ["Tender", "Penunjukan Langsung"],

      datasets: [
        {
          data: [tender, pl],

          borderWidth: 0,
        },
      ],
    },

    options: {
      responsive: true,

      maintainAspectRatio: false,

      cutout: "65%",

      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });
}

/* =========================================================
   STATUS CHART
   ========================================================= */

function renderStatusChart(data) {
  const canvas = $("#statusChart");

  if (!canvas) {
    return;
  }

  const statusMap = new Map();

  data.forEach((item) => {
    const status = String(item.progress || "Belum Ada Status").trim();

    const current = statusMap.get(status) || 0;

    statusMap.set(status, current + 1);
  });

  const sorted = [...statusMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  if (STATE.charts.status) {
    STATE.charts.status.destroy();
  }

  STATE.charts.status = new Chart(canvas, {
    type: "bar",

    data: {
      labels: sorted.map((item) => item[0]),

      datasets: [
        {
          label: "Jumlah Paket",

          data: sorted.map((item) => item[1]),

          borderRadius: 6,

          borderSkipped: false,
        },
      ],
    },

    options: {
      responsive: true,

      maintainAspectRatio: false,

      plugins: {
        legend: {
          display: false,
        },
      },

      scales: {
        y: {
          beginAtZero: true,

          ticks: {
            precision: 0,
          },
        },

        x: {
          ticks: {
            autoSkip: false,
          },
        },
      },
    },
  });
}

/* =========================================================
   RUPA
   ========================================================= */

function renderRupa() {
  const tbody = $("#rupaTableBody");

  const data = STATE.data.rupa;

  if (!data.length) {
    tbody.innerHTML = `
            <tr>
                <td colspan="9" class="empty-table">
                    Tidak ada data Rupa.
                </td>
            </tr>
        `;

    return;
  }

  tbody.innerHTML = data
    .map((item, index) => {
      return `
                    <tr>

                        <td>
                            ${index + 1}
                        </td>

                        <td class="font-semibold text-slate-700">
                            ${escapeHtml(item.nomorRupa || "-")}
                        </td>

                        <td>
                            <div class="max-w-sm truncate"
                                 title="${escapeAttribute(item.judulPekerjaan || "")}">
                                ${escapeHtml(item.judulPekerjaan || "-")}
                            </div>
                        </td>

                        <td>
                            ${escapeHtml(item.bulan || "-")}
                        </td>

                        <td>
                            ${escapeHtml(item.tahun || "-")}
                        </td>

                        <td>
                            ${escapeHtml(item.jenisPengadaan || "-")}
                        </td>

                        <td class="whitespace-nowrap">
                            ${formatRupiah(item.estimasiNilai)}
                        </td>

                        <td>
                            ${escapeHtml(item.metodePemilihan || "-")}
                        </td>

                        <td>
                            ${escapeHtml(item.bagian || "-")}
                        </td>

                    </tr>
                `;
    })
    .join("");
}

/* =========================================================
   REPORT
   ========================================================= */

function renderReports() {
  renderReportBagian();

  renderReportJenis();
}

/* =========================================================
   REPORT - BAGIAN
   ========================================================= */

function renderReportBagian() {
  const tbody = $("#reportBagianBody");

  const map = new Map();

  getAllProcurement().forEach((item) => {
    const bagian = String(item.bagian || "Tidak Ada").trim();

    map.set(bagian, (map.get(bagian) || 0) + 1);
  });

  const rows = [...map.entries()].sort((a, b) => b[1] - a[1]);

  tbody.innerHTML = rows
    .map((item) => {
      return `
                    <tr>

                        <td class="font-medium text-slate-700">
                            ${escapeHtml(item[0])}
                        </td>

                        <td>
                            ${formatNumber(item[1])}
                        </td>

                    </tr>
                `;
    })
    .join("");
}

/* =========================================================
   REPORT - JENIS
   ========================================================= */

function renderReportJenis() {
  const tbody = $("#reportJenisBody");

  const map = new Map();

  getAllProcurement().forEach((item) => {
    const jenis = String(item.jenisPengadaan || "Tidak Ada").trim();

    map.set(jenis, (map.get(jenis) || 0) + 1);
  });

  const rows = [...map.entries()].sort((a, b) => b[1] - a[1]);

  tbody.innerHTML = rows
    .map((item) => {
      return `
                    <tr>

                        <td class="font-medium text-slate-700">
                            ${escapeHtml(item[0])}
                        </td>

                        <td>
                            ${formatNumber(item[1])}
                        </td>

                    </tr>
                `;
    })
    .join("");
}

/* =========================================================
   NAVIGATION
   ========================================================= */

function navigateTo(page) {
  const titles = {
    dashboard: {
      title: "Dashboard",
      subtitle: "Monitoring Pengadaan Tahun 2026",
    },

    rupa: {
      title: "Rupa",
      subtitle: "Rencana Umum Pengadaan",
    },

    report: {
      title: "Report",
      subtitle: "Rekapitulasi data pengadaan",
    },

    efisiensi: {
      title: "Efisiensi",
      subtitle: "Analisis efisiensi anggaran",
    },
  };

  document.querySelectorAll(".page-content").forEach((pageElement) => {
    pageElement.classList.add("hidden");
  });

  const target = $(`#page-${page}`);

  if (target) {
    target.classList.remove("hidden");
  }

  document.querySelectorAll("[data-page]").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  const config = titles[page] || titles.dashboard;

  setText("#pageTitle", config.title);

  setText("#pageSubtitle", config.subtitle);

  STATE.currentPage = page;

  closeSidebar();
}

/* =========================================================
   MOBILE SIDEBAR
   ========================================================= */

function openSidebar() {
  $("#sidebar")?.classList.remove("-translate-x-full");

  $("#sidebarOverlay")?.classList.remove("hidden");
}

function closeSidebar() {
  $("#sidebar")?.classList.add("-translate-x-full");

  $("#sidebarOverlay")?.classList.add("hidden");
}

/* =========================================================
   EXPORT DASHBOARD
   ========================================================= */

function exportDashboard() {
  const data = STATE.filteredProcurement;

  if (!data.length) {
    alert("Tidak ada data untuk diekspor.");

    return;
  }

  const exportData = data.map((item, index) => {
    return {
      No: index + 1,

      "No. Paket": item.nomorPaket || "",

      "Uraian Pekerjaan": item.uraianPekerjaan || "",

      Bagian: item.bagian || "",

      "Nilai HPS": item.nilaiHPS || "",

      "Jenis Pengadaan": item.jenisPengadaan || "",

      "Metode Pemilihan": item.metodePemilihan || "",

      Vendor: item.vendor || "",

      Keterangan: item.keterangan || "",

      PIC: item.pic || "",

      Tim: item.tim || "",

      Progress: item.progress || "",

      "Nilai Anggaran": item.nilaiAnggaran || "",

      "No RUP": item.noRup || "",
    };
  });

  downloadExcel(exportData, "Monitoring_Pengadaan_2026.xlsx", "Dashboard");
}

/* =========================================================
   EXPORT RUPA
   ========================================================= */

function exportRupa() {
  const data = STATE.data.rupa;

  if (!data.length) {
    alert("Tidak ada data Rupa untuk diekspor.");

    return;
  }

  const exportData = data.map((item, index) => {
    return {
      No: index + 1,

      "Nomor RUPA": item.nomorRupa || "",

      "Judul Pekerjaan": item.judulPekerjaan || "",

      Bulan: item.bulan || "",

      Tahun: item.tahun || "",

      "Jenis Pengadaan": item.jenisPengadaan || "",

      "Estimasi Nilai": item.estimasiNilai || "",

      "Metode Pemilihan": item.metodePemilihan || "",

      "Rencana Capaian": item.rencanaCapaian || "",

      "Sumber Anggaran": item.sumberAnggaran || "",

      Keterangan: item.keterangan || "",

      Bagian: item.bagian || "",
    };
  });

  downloadExcel(exportData, "Rupa_2026.xlsx", "Rupa");
}

/* =========================================================
   EXCEL HELPER
   ========================================================= */

function downloadExcel(data, filename, sheetName) {
  if (typeof XLSX === "undefined") {
    alert("Library Excel belum tersedia.");

    return;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);

  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  XLSX.writeFile(workbook, filename);
}

/* =========================================================
   UI STATE
   ========================================================= */

function showLoading() {
  $("#loadingScreen")?.classList.remove("hidden");

  $("#errorScreen")?.classList.add("hidden");

  $("#app")?.classList.add("hidden");
}

function showApp() {
  $("#loadingScreen")?.classList.add("hidden");

  $("#errorScreen")?.classList.add("hidden");

  $("#app")?.classList.remove("hidden");

  refreshIcons();
}

function showError(message) {
  $("#loadingScreen")?.classList.add("hidden");

  $("#app")?.classList.add("hidden");

  $("#errorScreen")?.classList.remove("hidden");

  setText("#errorMessage", message);

  refreshIcons();
}

/* =========================================================
   LAST UPDATE
   ========================================================= */

function updateLastUpdate(timestamp) {
  const element = $("#lastUpdate");

  if (!element) {
    return;
  }

  if (!timestamp) {
    element.innerHTML = `
            <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span>Data berhasil dimuat</span>
        `;

    return;
  }

  const date = new Date(timestamp);

  element.innerHTML = `
        <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
        <span>
            Update ${date.toLocaleString("id-ID")}
        </span>
    `;
}

/* =========================================================
   TABLE SUMMARY
   ========================================================= */

function updateTableSummary(count) {
  setText("#tableSummary", `Menampilkan ${formatNumber(count)} paket pengadaan`);
}

/* =========================================================
   UTILITY
   ========================================================= */

function setText(selector, value) {
  const element = $(selector);

  if (element) {
    element.textContent = value;
  }
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("id-ID");
}

function formatRupiah(value) {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numeric = parseNumericValue(value);

  if (numeric === null) {
    return escapeHtml(String(value));
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(numeric);
}

function parseNumericValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  const text = String(value)
    .trim()
    .replace(/[^\d,-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");

  if (!text) {
    return null;
  }

  const number = Number(text);

  return Number.isFinite(number) ? number : null;
}

/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

/* =========================================================
   ICON REFRESH
   ========================================================= */

function refreshIcons() {
  if (window.lucide) {
    lucide.createIcons();
  }
}
