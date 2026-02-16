import { HttpError, ok, withErrorHandling } from "@/lib/server/api";
import { getSessionContext } from "@/lib/server/auth";
import { createImportRunFromCsv } from "@/lib/server/import-engine";

export async function POST(request: Request) {
  return withErrorHandling(async () => {
    const session = await getSessionContext();
    const formData = await request.formData();
    const file = formData.get("file");
    const idempotencyKey = formData.get("idempotencyKey");

    if (!file || !(file instanceof File)) {
      throw new HttpError(400, "VALIDATION_ERROR", "CSV file is required");
    }
    if (!file.name.endsWith(".csv")) {
      throw new HttpError(400, "VALIDATION_ERROR", "File must be .csv");
    }

    const csvText = await file.text();
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
