import type { DocumentSourceType } from "@/lib/domain/types";

export type ClassificationInput = {
  filename: string;
  mimeType?: string;
  bytes: Uint8Array;
};

export type ClassificationResult =
  | {
      ok: true;
      sourceType: Exclude<DocumentSourceType, "UNSUPPORTED">;
      normalizedMimeType: string;
      confidence: "HIGH" | "MEDIUM";
      warnings: string[];
    }
  | {
      ok: false;
      sourceType: "UNSUPPORTED";
      normalizedMimeType: string;
      error: string;
      warnings: string[];
    };

const mimeToType: Record<string, Exclude<DocumentSourceType, "UNSUPPORTED">> = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.ms-excel": "XLS",
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "text/plain": "TXT",
  "image/png": "PNG",
  "image/jpeg": "JPEG"
};

const extensionToType: Record<string, Exclude<DocumentSourceType, "UNSUPPORTED">> = {
  xlsx: "XLSX",
  xls: "XLS",
  pdf: "PDF",
  docx: "DOCX",
  txt: "TXT",
  png: "PNG",
  jpg: "JPEG",
  jpeg: "JPEG"
};

export function classifyDocument(input: ClassificationInput): ClassificationResult {
  const warnings: string[] = [];
  const extension = input.filename.split(".").pop()?.toLowerCase() ?? "";
  const extensionType = extensionToType[extension];
  const mime = normalizeMime(input.mimeType);
  const mimeType = mimeToType[mime];
  const signatureType = classifyBySignature(input.bytes);
  const zipOfficeType = signatureType === "ZIP" ? officeTypeFromExtension(extensionType) : null;
  const nonZipSignatureType = signatureType === "ZIP" ? null : signatureType;
  const chosenType = zipOfficeType ?? nonZipSignatureType ?? mimeType ?? extensionType;

  if (signatureType && signatureType !== "ZIP" && extensionType && signatureType !== extensionType) {
    warnings.push(`Extension suggests ${extensionType}, but file signature suggests ${signatureType}.`);
  }

  if (mimeType && chosenType && mimeType !== chosenType) {
    warnings.push(`MIME type suggests ${mimeType}, but detected type is ${chosenType}.`);
  }

  if (!chosenType) {
    return {
      ok: false,
      sourceType: "UNSUPPORTED",
      normalizedMimeType: mime || "application/octet-stream",
      error: "Unsupported document type.",
      warnings
    };
  }

  if (chosenType === "XLS" && !signatureType && !mimeType) {
    warnings.push("Legacy XLS support is classified, but deterministic parsing may be limited.");
  }

  return {
    ok: true,
    sourceType: chosenType,
    normalizedMimeType: mimeForType(chosenType, mime),
    confidence: signatureType || mimeType ? "HIGH" : "MEDIUM",
    warnings
  };
}

function normalizeMime(mimeType: string | undefined): string {
  return (mimeType ?? "").split(";")[0].trim().toLowerCase();
}

function classifyBySignature(bytes: Uint8Array): Exclude<DocumentSourceType, "UNSUPPORTED"> | "ZIP" | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46])) return "PDF";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "PNG";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "JPEG";
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04])) return "ZIP";
  return null;
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

function officeTypeFromExtension(extensionType: Exclude<DocumentSourceType, "UNSUPPORTED"> | undefined) {
  return extensionType === "XLSX" || extensionType === "DOCX" ? extensionType : null;
}

function mimeForType(type: Exclude<DocumentSourceType, "UNSUPPORTED">, detectedMime: string): string {
  if (detectedMime && mimeToType[detectedMime] === type) {
    return detectedMime;
  }

  return Object.entries(mimeToType).find(([, sourceType]) => sourceType === type)?.[0] ?? "application/octet-stream";
}
