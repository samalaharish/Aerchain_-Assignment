import type { QualityStatus, QuestionnaireAnswer, Vendor } from "@/lib/domain/types";

export function calculateVendorQualityStatus(answers: QuestionnaireAnswer[]): QualityStatus {
  if (answers.length === 0) {
    return "NOT_EVALUATED";
  }

  if (answers.some((answer) => answer.status === "FAIL")) {
    return "FAIL";
  }

  if (answers.some((answer) => answer.status === "INCOMPLETE" || answer.status === "NOT_EVALUATED")) {
    return "INCOMPLETE";
  }

  return "PASS";
}

export function isQualityApproved(vendor: Vendor): boolean {
  return vendor.qualityStatus === "PASS";
}
