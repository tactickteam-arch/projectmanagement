import "server-only";
import ExcelJS from "exceljs";

export interface SheetSpec {
  name: string;
  columns: { header: string; key: string; width?: number; numFmt?: string }[];
  rows: Record<string, string | number | null>[];
}

/** Builds an .xlsx workbook (free, open-source exceljs) and returns it as a download response. */
export async function xlsxResponse(fileName: string, sheets: SheetSpec[]): Promise<Response> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Store Launch Tracker";
  wb.created = new Date();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31));
    ws.columns = s.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18, style: c.numFmt ? { numFmt: c.numFmt } : {} }));
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
    for (const r of s.rows) ws.addRow(r);
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Response(buf as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}

export const INR_FORMAT = '"₹"#,##0';
