import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import api from "./api";
import { ApiResponse } from "../types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExportMeta {
  businessName: string;
  exportedAt: string;
  startDate: string;
  endDate: string;
}

interface ExportSummary {
  totalRevenue: number;
  totalCOGS: number;
  totalProfit: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  salesCount: number;
  totalOutstandingCredits: number;
  stockValue: number;
}

interface ExportSale {
  date: string;
  items: { name: string; qty: number; price: number; total: number }[];
  total: number;
  profit: number;
  payment: string;
}

interface ExportExpense {
  date: string;
  description: string;
  category: string;
  amount: number;
}

interface ExportCredit {
  customer: string;
  description: string;
  original: number;
  balance: number;
  dueDate: string;
  status: string;
}

interface ExportStock {
  name: string;
  category: string;
  quantity: number;
  sellingPrice: number;
  costPrice: number;
  value: number;
}

interface ExportData {
  meta: ExportMeta;
  summary: ExportSummary;
  sales: ExportSale[];
  expenses: ExportExpense[];
  credits: ExportCredit[];
  stock: ExportStock[];
}

// ─── Formatters ───────────────────────────────────────────────────────────────

const naira = (n: number) =>
  `₦${Math.round(n).toLocaleString("en-NG")}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });

const fmtDateRange = (start: string, end: string) =>
  `${fmtDate(start)} – ${fmtDate(end)}`;

// ─── HTML Template ────────────────────────────────────────────────────────────

function buildHTML(data: ExportData): string {
  const { meta, summary, sales, expenses, credits, stock } = data;

  const profitColor = summary.netProfit >= 0 ? "#16A34A" : "#DC2626";

  const saleRows = sales.slice(0, 50).map((s) => `
    <tr>
      <td>${fmtDate(s.date)}</td>
      <td>${s.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}</td>
      <td>${s.payment}</td>
      <td style="text-align:right">${naira(s.total)}</td>
      <td style="text-align:right;color:${s.profit >= 0 ? "#16A34A" : "#DC2626"}">${naira(s.profit)}</td>
    </tr>`).join("");

  const expenseRows = expenses.slice(0, 50).map((e) => `
    <tr>
      <td>${fmtDate(e.date)}</td>
      <td>${e.description}</td>
      <td>${e.category.replace(/_/g, " ")}</td>
      <td style="text-align:right;color:#DC2626">${naira(e.amount)}</td>
    </tr>`).join("");

  const creditRows = credits.map((c) => `
    <tr>
      <td>${c.customer}</td>
      <td>${c.description}</td>
      <td style="text-align:right">${naira(c.original)}</td>
      <td style="text-align:right;color:#DC2626;font-weight:700">${naira(c.balance)}</td>
      <td>${fmtDate(c.dueDate)}</td>
      <td style="color:${c.status === "overdue" ? "#DC2626" : c.status === "due_soon" ? "#D97706" : "#3B82F6"};font-weight:600">
        ${c.status.replace(/_/g, " ").toUpperCase()}
      </td>
    </tr>`).join("");

  const stockRows = stock.map((s) => `
    <tr>
      <td>${s.name}</td>
      <td>${s.category.replace(/_/g, " ")}</td>
      <td style="text-align:right">${s.quantity}</td>
      <td style="text-align:right">${naira(s.sellingPrice)}</td>
      <td style="text-align:right">${naira(s.costPrice ?? 0)}</td>
      <td style="text-align:right;font-weight:700">${naira(s.value)}</td>
    </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>OwoTrack Business Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Arial, sans-serif; font-size: 13px; color: #1C1917; background: #fff; padding: 32px; }

    /* Header */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 3px solid #1A6B3C; }
    .brand { font-size: 22px; font-weight: 900; color: #1A6B3C; letter-spacing: -0.5px; }
    .brand span { color: #F59E0B; }
    .report-meta { text-align: right; }
    .report-meta h2 { font-size: 16px; font-weight: 800; color: #1C1917; margin-bottom: 4px; }
    .report-meta p { font-size: 11px; color: #6B7280; }

    /* Summary cards */
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 32px; }
    .card { background: #F9FAFB; border-radius: 12px; padding: 16px; border: 1px solid #E5E7EB; }
    .card-label { font-size: 10px; font-weight: 700; color: #9CA3AF; letter-spacing: 0.8px; margin-bottom: 6px; }
    .card-value { font-size: 20px; font-weight: 900; }
    .card-sub { font-size: 10px; color: #9CA3AF; margin-top: 4px; }
    .card.green { background: #F0FDF4; border-color: #BBF7D0; }
    .card.red   { background: #FEF2F2; border-color: #FECACA; }
    .card.blue  { background: #EFF6FF; border-color: #BFDBFE; }
    .card.amber { background: #FFFBEB; border-color: #FDE68A; }

    /* Section */
    .section { margin-bottom: 32px; }
    .section-title { font-size: 14px; font-weight: 800; color: #1C1917; margin-bottom: 12px; padding-bottom: 6px; border-bottom: 2px solid #E5E7EB; display: flex; align-items: center; gap: 8px; }
    .section-title .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }

    /* Table */
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #F3F4F6; padding: 10px 12px; text-align: left; font-weight: 700; font-size: 10px; color: #6B7280; letter-spacing: 0.5px; border-bottom: 1px solid #E5E7EB; }
    td { padding: 10px 12px; border-bottom: 1px solid #F3F4F6; vertical-align: top; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #FAFAFA; }
    .empty-row td { text-align: center; color: #9CA3AF; padding: 20px; font-style: italic; }

    /* Footer */
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #E5E7EB; display: flex; justify-content: space-between; font-size: 10px; color: #9CA3AF; }
    .note { font-size: 10px; color: #9CA3AF; margin-top: 6px; font-style: italic; }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <div>
      <div class="brand">Owo<span>Track</span></div>
      <div style="font-size:12px;color:#6B7280;margin-top:4px;">Business Management App</div>
    </div>
    <div class="report-meta">
      <h2>${meta.businessName}</h2>
      <p>Period: ${fmtDateRange(meta.startDate, meta.endDate)}</p>
      <p>Generated: ${fmtDate(meta.exportedAt)}</p>
    </div>
  </div>

  <!-- Summary Cards -->
  <div class="summary-grid">
    <div class="card green">
      <div class="card-label">TOTAL REVENUE</div>
      <div class="card-value" style="color:#16A34A">${naira(summary.totalRevenue)}</div>
      <div class="card-sub">${summary.salesCount} transactions</div>
    </div>
    <div class="card ${summary.netProfit >= 0 ? "green" : "red"}">
      <div class="card-label">NET PROFIT</div>
      <div class="card-value" style="color:${profitColor}">${naira(summary.netProfit)}</div>
      <div class="card-sub">${summary.profitMargin}% margin</div>
    </div>
    <div class="card red">
      <div class="card-label">TOTAL EXPENSES</div>
      <div class="card-value" style="color:#DC2626">${naira(summary.totalExpenses)}</div>
      <div class="card-sub">Operating costs</div>
    </div>
    <div class="card blue">
      <div class="card-label">GROSS PROFIT</div>
      <div class="card-value" style="color:#2563EB">${naira(summary.totalProfit)}</div>
      <div class="card-sub">Before expenses</div>
    </div>
    <div class="card amber">
      <div class="card-label">OUTSTANDING CREDITS</div>
      <div class="card-value" style="color:#D97706">${naira(summary.totalOutstandingCredits)}</div>
      <div class="card-sub">${credits.length} customer(s)</div>
    </div>
    <div class="card">
      <div class="card-label">STOCK VALUE</div>
      <div class="card-value" style="color:#7C3AED">${naira(summary.stockValue)}</div>
      <div class="card-sub">${stock.length} product(s)</div>
    </div>
  </div>

  <!-- Sales -->
  <div class="section">
    <div class="section-title">
      <span class="dot" style="background:#16A34A"></span>
      Sales Records (${sales.length} transactions${sales.length > 50 ? " · showing first 50" : ""})
    </div>
    <table>
      <thead>
        <tr>
          <th>DATE</th><th>ITEMS</th><th>PAYMENT</th>
          <th style="text-align:right">REVENUE</th><th style="text-align:right">PROFIT</th>
        </tr>
      </thead>
      <tbody>
        ${saleRows || `<tr class="empty-row"><td colspan="5">No sales recorded in this period</td></tr>`}
      </tbody>
    </table>
  </div>

  <!-- Expenses -->
  <div class="section">
    <div class="section-title">
      <span class="dot" style="background:#DC2626"></span>
      Expenses (${expenses.length} entries${expenses.length > 50 ? " · showing first 50" : ""})
    </div>
    <table>
      <thead>
        <tr>
          <th>DATE</th><th>DESCRIPTION</th><th>CATEGORY</th>
          <th style="text-align:right">AMOUNT</th>
        </tr>
      </thead>
      <tbody>
        ${expenseRows || `<tr class="empty-row"><td colspan="4">No expenses recorded in this period</td></tr>`}
      </tbody>
    </table>
  </div>

  <!-- Credits -->
  <div class="section">
    <div class="section-title">
      <span class="dot" style="background:#D97706"></span>
      Outstanding Credits (${credits.length} customer(s))
    </div>
    <table>
      <thead>
        <tr>
          <th>CUSTOMER</th><th>FOR</th><th style="text-align:right">ORIGINAL</th>
          <th style="text-align:right">BALANCE DUE</th><th>DUE DATE</th><th>STATUS</th>
        </tr>
      </thead>
      <tbody>
        ${creditRows || `<tr class="empty-row"><td colspan="6">No outstanding credits</td></tr>`}
      </tbody>
    </table>
  </div>

  <!-- Stock -->
  <div class="section">
    <div class="section-title">
      <span class="dot" style="background:#7C3AED"></span>
      Stock Inventory (${stock.length} product(s))
    </div>
    <table>
      <thead>
        <tr>
          <th>PRODUCT</th><th>CATEGORY</th><th style="text-align:right">QTY</th>
          <th style="text-align:right">SELL PRICE</th><th style="text-align:right">COST</th>
          <th style="text-align:right">STOCK VALUE</th>
        </tr>
      </thead>
      <tbody>
        ${stockRows || `<tr class="empty-row"><td colspan="6">No stock items</td></tr>`}
      </tbody>
    </table>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div>Generated by OwoTrack · owotrack.com</div>
    <div>${meta.businessName} · ${fmtDate(meta.exportedAt)}</div>
  </div>

</body>
</html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const exportService = {
  async generateAndShare(startDate?: string, endDate?: string): Promise<void> {
    const params: Record<string, string> = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const res = await api.get<ApiResponse<ExportData>>("/reports/export", { params });
    const data = res.data.data;

    const html = buildHTML(data);

    const monthLabel = new Date(data.meta.startDate)
      .toLocaleDateString("en-NG", { month: "long", year: "numeric" })
      .replace(" ", "_");
    const fileName = `OwoTrack_Report_${monthLabel}`;

    // expo-print converts HTML → PDF and returns a local file URI
    const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) throw new Error("Sharing is not available on this device.");

    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: `Share ${fileName}`,
      UTI: "com.adobe.pdf",
    });
  },
};
