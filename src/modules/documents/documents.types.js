export const MAX_BANK_STATEMENT_SLOTS = 10;

export const DOCUMENT_CATALOG = (() => {
  const bankSlots = Array.from({ length: MAX_BANK_STATEMENT_SLOTS }, (_, i) => ({
    id: `bank_statement_${i + 1}`,
    label: `Bank statement (${i + 1})`,
  }));
  return [
    { id: "pan", label: "PAN card" },
    { id: "aadhaar", label: "Aadhaar" },
    { id: "form16", label: "Form 16" },
    ...bankSlots,
    { id: "salary_slip", label: "Salary slip" },
    { id: "address_proof", label: "Address proof" },
    { id: "photo_id", label: "Government photo ID" },
    { id: "tax_return", label: "Previous year ITR" },
    { id: "investment_proof", label: "Investment / 80C proof" },
    { id: "signed_agreement", label: "Signed agreement" },
  ];
})();

export const DOCUMENT_IDS = new Set(DOCUMENT_CATALOG.map((d) => d.id));
