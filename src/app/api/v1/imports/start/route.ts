import { HttpError, ok, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { createImportRunFromCsv } from "@/lib/server/import-engine";
import * as XLSX from "xlsx";

function getExtension(filename: string) {
  const parts = filename.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

export async function POST(request: Request) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const formData = await request.formData();
    const file = formData.get("file");
    const idempotencyKey = formData.get("idempotencyKey");

    if (!file || !(file instanceof File)) {
      throw new HttpError(400, "VALIDATION_ERROR", "Import file is required");
    }
    const extension = getExtension(file.name);
    if (!["csv", "xlsx", "xls"].includes(extension ?? "")) {
      throw new HttpError(400, "VALIDATION_ERROR", "File must be .csv, .xlsx, or .xls");
    }

    let csvText = "";
    if (extension === "csv") {
      csvText = await file.text();
    } else {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        throw new HttpError(400, "VALIDATION_ERROR", "Excel file has no sheets");
      }

      const worksheet = workbook.Sheets[firstSheetName];
      csvText = XLSX.utils.sheet_to_csv(worksheet, {
        blankrows: false,
      });
    }

    if (!csvText.trim()) {
      throw new HttpError(400, "VALIDATION_ERROR", "Import file is empty");
    }

    const importRun = await createImportRunFromCsv({
      workspaceId: session.workspaceId,
      uploadedById: session.userId,
      filename: file.name,
      csvText,
      idempotencyKey: typeof idempotencyKey === "string" ? idempotencyKey : undefined,
    });

    return ok(importRun);
  });
}
