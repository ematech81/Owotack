import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { Asset } from "expo-asset";
import { Sale, User } from "../types";

const naira = (n: number) => `₦${Math.round(n).toLocaleString("en-NG")}`;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" });

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", hour12: true });

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-NG", { weekday: "long" });

const PAYMENT_LABELS: Record<string, { bg: string; color: string; label: string }> = {
  cash:     { bg: "#D1FAE5", color: "#059669", label: "Cash" },
  transfer: { bg: "#DBEAFE", color: "#2563EB", label: "Transfer" },
  pos:      { bg: "#EDE9FE", color: "#7C3AED", label: "POS" },
  credit:   { bg: "#FEF3C7", color: "#D97706", label: "Credit" },
  mixed:    { bg: "#F3F4F6", color: "#6B7280", label: "Mixed" },
};

async function getLogoBase64(): Promise<string> {
  try {
    const asset = Asset.fromModule(require("../../assets/images/icon.png"));
    await asset.downloadAsync();
    if (!asset.localUri) return "";
    const b64 = await FileSystem.readAsStringAsync(asset.localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return `data:image/png;base64,${b64}`;
  } catch {
    return "";
  }
}

function initials(name: string): string {
  return (name || "W")
    .split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}

function dotGrid(): string {
  return Array.from({ length: 24 })
    .map((_, i) => `<div style="width:4px;height:4px;border-radius:2px;background:rgba(255,255,255,${i % 3 === 0 ? "0.3" : "0.15"});"></div>`)
    .join("");
}

function scallops(): string {
  return Array.from({ length: 18 })
    .map(() => `<div style="width:20px;height:20px;border-radius:50%;background:#f5f5f5;flex-shrink:0;"></div>`)
    .join("");
}

function qrDecor(color: string): string {
  return `<div style="display:flex;flex-wrap:wrap;width:40px;gap:2px;flex-shrink:0;">
    ${Array.from({ length: 16 }).map((_, i) =>
      `<div style="width:8px;height:8px;border-radius:1px;background:${i % 3 === 0 ? color + "60" : color + "22"};"></div>`
    ).join("")}
  </div>`;
}

function buildReceiptHTML(sale: Sale, businessName: string, logoSrc: string): string {
  const pc = PAYMENT_LABELS[sale.paymentType] ?? PAYMENT_LABELS.cash;
  const dateRef = sale.createdAt || sale.date;
  const customer = sale.customerName || "Walk-in Customer";
  const synced = sale.syncStatus !== "pending";

  const subtotal = sale.subtotal ?? sale.totalAmount;
  const discountAmount = sale.discountAmount ?? 0;
  const taxAmount = sale.taxAmount ?? 0;
  const hasAdjustment = discountAmount > 0 || taxAmount > 0;

  const logoEl = logoSrc
    ? `<img src="${logoSrc}" style="width:64px;height:64px;border-radius:32px;object-fit:cover;border:2px solid rgba(255,255,255,0.4);" />`
    : `<div style="width:64px;height:64px;border-radius:32px;background:rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;color:#fff;border:2px solid rgba(255,255,255,0.3);">O</div>`;

  const itemRows = sale.items.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? "rgba(26,107,60,0.03)" : "#fff"};">
      <td style="padding:12px 20px;font-size:13px;font-weight:700;color:#1a202c;">
        ${item.productName}
        <div style="font-size:10px;color:#718096;font-weight:500;margin-top:2px;">${item.unit}</div>
      </td>
      <td style="padding:12px 8px;text-align:center;">
        <span style="display:inline-block;background:rgba(26,107,60,0.12);color:#1A6B3C;font-size:13px;font-weight:800;padding:4px 10px;border-radius:6px;">${item.quantity}</span>
      </td>
      <td style="padding:12px 8px;text-align:right;font-size:12px;color:#718096;font-weight:500;">${naira(item.unitPrice)}</td>
      <td style="padding:12px 20px;text-align:right;font-size:14px;font-weight:900;color:#1a202c;letter-spacing:-0.2px;">${naira(item.totalAmount)}</td>
    </tr>`).join("");

  const adjustmentRows = hasAdjustment ? `
    <div style="margin:8px 20px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
      <div style="display:flex;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(0,0,0,0.05);">
        <span style="font-size:13px;font-weight:600;color:#718096;">Subtotal</span>
        <span style="font-size:13px;font-weight:800;color:#1a202c;">${naira(subtotal)}</span>
      </div>
      ${discountAmount > 0 ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border-bottom:1px solid rgba(0,0,0,0.05);">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:22px;height:22px;border-radius:6px;background:#FEF3C7;display:flex;align-items:center;justify-content:center;font-size:11px;">🏷</div>
          <span style="font-size:13px;font-weight:600;color:#D97706;">Discount${sale.discountType === "percent" ? ` (${sale.discount}%)` : ""}</span>
        </div>
        <span style="font-size:13px;font-weight:800;color:#D97706;">-${naira(discountAmount)}</span>
      </div>` : ""}
      ${taxAmount > 0 ? `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="width:22px;height:22px;border-radius:6px;background:#DBEAFE;display:flex;align-items:center;justify-content:center;font-size:11px;">🧮</div>
          <span style="font-size:13px;font-weight:600;color:#2563EB;">Tax (${sale.tax}%)</span>
        </div>
        <span style="font-size:13px;font-weight:800;color:#2563EB;">+${naira(taxAmount)}</span>
      </div>` : ""}
    </div>` : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; background: #f0f4f0; padding: 24px 12px; }
    .page { max-width: 400px; margin: 0 auto; }
    .receipt { background: #fff; border-radius: 20px; overflow: hidden; box-shadow: 0 16px 48px rgba(0,0,0,0.18); }
    table { width: 100%; border-collapse: collapse; }
    .dash-row { display: flex; gap: 4px; padding: 2px 20px; }
    .dash { flex: 1; height: 1.5px; background: #e2e8f0; border-radius: 1px; opacity: 0.7; }
  </style>
</head>
<body>
<div class="page"><div class="receipt">

  <!-- ── HEADER ─────────────────────────────────────────────────────────────── -->
  <div style="background:linear-gradient(135deg,#0D4728 0%,#1A6B3C 50%,#2E9E58 100%);padding:28px 24px 36px;text-align:center;position:relative;overflow:hidden;">
    <!-- decor circles -->
    <div style="position:absolute;width:180px;height:180px;border-radius:90px;background:rgba(255,255,255,0.05);top:-60px;right:-50px;"></div>
    <div style="position:absolute;width:100px;height:100px;border-radius:50px;background:rgba(255,255,255,0.04);bottom:-30px;left:-20px;"></div>
    <div style="position:absolute;width:60px;height:60px;border-radius:30px;background:rgba(255,255,255,0.06);top:20px;left:30px;"></div>
    <!-- dot grid -->
    <div style="position:absolute;top:16px;right:16px;display:flex;flex-wrap:wrap;width:64px;gap:4px;">${dotGrid()}</div>

    <!-- logo ring -->
    <div style="display:inline-flex;width:80px;height:80px;border-radius:40px;border:2px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.1);padding:4px;align-items:center;justify-content:center;margin-bottom:14px;">
      <div style="width:64px;height:64px;border-radius:32px;overflow:hidden;border:2px solid rgba(255,255,255,0.4);">
        ${logoEl}
      </div>
    </div>

    <!-- business name -->
    <div style="font-size:22px;font-weight:900;color:#fff;letter-spacing:-0.3px;margin-bottom:10px;">${businessName}</div>

    <!-- receipt pill -->
    <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(255,255,255,0.15);padding:5px 14px;border-radius:999px;margin-bottom:10px;">
      <div style="width:4px;height:4px;border-radius:2px;background:rgba(255,255,255,0.6);"></div>
      <span style="font-size:10px;color:rgba(255,255,255,0.9);letter-spacing:2.5px;font-weight:800;">SALES RECEIPT</span>
      <div style="width:4px;height:4px;border-radius:2px;background:rgba(255,255,255,0.6);"></div>
    </div>

    <!-- sync status -->
    <div style="display:flex;justify-content:center;">
      <div style="display:inline-flex;align-items:center;gap:4px;background:${synced ? "rgba(209,250,229,0.25)" : "rgba(238,242,255,0.25)"};padding:3px 8px;border-radius:999px;">
        <span style="font-size:10px;color:${synced ? "#86efac" : "#a5b4fc"};font-weight:700;">${synced ? "✓ Synced" : "⏱ Pending sync"}</span>
      </div>
    </div>
  </div>

  <!-- ── SCALLOPED EDGE (top) ────────────────────────────────────────────────── -->
  <div style="display:flex;justify-content:space-between;padding:0 4px;margin-top:-11px;overflow:hidden;background:#f0f4f0;">
    ${scallops()}
  </div>

  <!-- ── INVOICE META BAR ───────────────────────────────────────────────────── -->
  <div style="display:flex;align-items:stretch;padding:14px 20px;background:#fff;">
    <!-- Invoice -->
    <div style="flex:1;">
      <div style="font-size:9px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#a0aec0;margin-bottom:3px;">INVOICE</div>
      <div style="font-size:17px;font-weight:900;color:#1A6B3C;letter-spacing:-0.3px;">${sale.invoiceNumber ?? "—"}</div>
    </div>
    <div style="width:1px;background:#e2e8f0;margin:0 12px;"></div>
    <!-- Date -->
    <div style="flex:1;text-align:center;">
      <div style="font-size:9px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#a0aec0;margin-bottom:3px;">DATE</div>
      <div style="font-size:13px;font-weight:700;color:#1a202c;">${fmtDate(dateRef)}</div>
      <div style="font-size:10px;font-weight:600;color:#718096;margin-top:2px;">${fmtDay(dateRef)}</div>
    </div>
    <div style="width:1px;background:#e2e8f0;margin:0 12px;"></div>
    <!-- Time -->
    <div style="flex:1;text-align:right;">
      <div style="font-size:9px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#a0aec0;margin-bottom:3px;">TIME</div>
      <div style="font-size:13px;font-weight:700;color:#1a202c;">${fmtTime(dateRef)}</div>
      <div style="font-size:10px;font-weight:600;color:#718096;margin-top:2px;">${sale.items.length} item${sale.items.length !== 1 ? "s" : ""}</div>
    </div>
  </div>

  <!-- dashed divider -->
  <div class="dash-row">${Array.from({ length: 28 }).map(() => `<div class="dash"></div>`).join("")}</div>

  <!-- ── CUSTOMER BANNER ────────────────────────────────────────────────────── -->
  <div style="display:flex;align-items:center;gap:12px;padding:12px 20px;background:rgba(26,107,60,0.06);">
    <div style="width:36px;height:36px;border-radius:18px;background:#1A6B3C;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;color:#fff;flex-shrink:0;">
      ${initials(customer)}
    </div>
    <div style="flex:1;">
      <div style="font-size:9px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:#a0aec0;margin-bottom:2px;">SOLD TO</div>
      <div style="font-size:15px;font-weight:800;color:#1a202c;">${customer}</div>
    </div>
  </div>

  <!-- dashed divider -->
  <div class="dash-row">${Array.from({ length: 28 }).map(() => `<div class="dash"></div>`).join("")}</div>

  <!-- ── ITEMS TABLE ─────────────────────────────────────────────────────────── -->
  <table>
    <thead>
      <tr style="background:#f7f8fa;">
        <th style="padding:8px 20px;text-align:left;font-size:9px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;color:#718096;">ITEM</th>
        <th style="padding:8px;text-align:center;font-size:9px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;color:#718096;width:50px;">QTY</th>
        <th style="padding:8px;text-align:right;font-size:9px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;color:#718096;width:80px;">PRICE</th>
        <th style="padding:8px 20px;text-align:right;font-size:9px;font-weight:800;letter-spacing:0.8px;text-transform:uppercase;color:#718096;width:90px;">TOTAL</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- ── ADJUSTMENTS ────────────────────────────────────────────────────────── -->
  ${adjustmentRows}

  <!-- dashed divider -->
  <div class="dash-row" style="margin-top:8px;">${Array.from({ length: 28 }).map(() => `<div class="dash"></div>`).join("")}</div>

  <!-- ── GRAND TOTAL ─────────────────────────────────────────────────────────── -->
  <div style="padding:12px 20px 8px;">
    <!-- payment method -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <span style="font-size:13px;font-weight:600;color:#718096;">Payment Method</span>
      <span style="display:inline-block;background:${pc.bg};color:${pc.color};font-size:11px;font-weight:800;letter-spacing:0.5px;padding:5px 12px;border-radius:999px;">${pc.label.toUpperCase()}</span>
    </div>
    <!-- grand total card -->
    <div style="display:flex;align-items:center;background:rgba(26,107,60,0.08);border-radius:12px;overflow:hidden;padding:16px;">
      <div style="width:4px;align-self:stretch;background:#1A6B3C;border-radius:2px;margin-right:14px;"></div>
      <div style="flex:1;">
        <div style="font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#718096;">GRAND TOTAL</div>
        <div style="font-size:11px;font-weight:600;color:#718096;margin-top:2px;">${sale.items.length} item${sale.items.length !== 1 ? "s" : ""}</div>
      </div>
      <div style="font-size:28px;font-weight:900;color:#1A6B3C;letter-spacing:-0.8px;">${naira(sale.totalAmount)}</div>
    </div>
  </div>

  <!-- ── SCALLOPED EDGE (bottom) ───────────────────────────────────────────── -->
  <div style="display:flex;justify-content:space-between;padding:0 4px;overflow:hidden;background:#f0f4f0;">
    ${scallops()}
  </div>

  <!-- ── FOOTER ──────────────────────────────────────────────────────────────── -->
  <div style="display:flex;align-items:center;padding:18px 12px;gap:10px;background:rgba(26,107,60,0.06);border-top:1px solid #e8f0eb;">
    ${qrDecor("#1A6B3C")}
    <div style="flex:1;text-align:center;">
      <div style="font-size:13px;font-weight:800;color:#1a202c;margin-bottom:5px;">Thank you for your business! 🙏</div>
      <div style="font-size:10px;color:#718096;line-height:1.5;">We appreciate your trust and look forward<br>to serving you again.</div>
      <div style="display:flex;justify-content:center;align-items:center;gap:4px;margin-top:6px;">
        <span style="font-size:10px;font-weight:600;color:#a0aec0;">Powered by</span>
        <span style="font-size:12px;font-weight:900;color:#1A6B3C;">OwoTrack</span>
      </div>
    </div>
    ${qrDecor("#1A6B3C")}
  </div>

</div></div>
</body>
</html>`;
}

function getFileName(sale: Sale): string {
  return `Invoice_${sale.invoiceNumber ?? sale.localId.slice(-6).toUpperCase()}.pdf`;
}

export const receiptService = {
  async shareAsPDF(sale: Sale, user: User): Promise<void> {
    const businessName = user.businessName || user.name;
    const logoSrc = await getLogoBase64();
    const html = buildReceiptHTML(sale, businessName, logoSrc);
    const { uri } = await Print.printToFileAsync({ html, width: 428, height: 926 });
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) throw new Error("Sharing is not available on this device.");
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: `Share ${getFileName(sale)}`,
      UTI: "com.adobe.pdf",
    });
  },

  async downloadPDF(sale: Sale, user: User): Promise<string> {
    const businessName = user.businessName || user.name;
    const logoSrc = await getLogoBase64();
    const html = buildReceiptHTML(sale, businessName, logoSrc);
    const { uri } = await Print.printToFileAsync({ html, width: 428, height: 926 });

    const fileName = getFileName(sale);
    const destPath = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.copyAsync({ from: uri, to: destPath });

    // Open the share/save sheet so the user can send it to Files, Drive, WhatsApp, etc.
    // This is the correct mobile pattern — there is no universal "Downloads folder" on iOS/Android for documents.
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(destPath, {
        mimeType: "application/pdf",
        dialogTitle: `Save ${fileName}`,
        UTI: "com.adobe.pdf",
      });
    }

    return fileName;
  },

  buildHTML: buildReceiptHTML,
};
