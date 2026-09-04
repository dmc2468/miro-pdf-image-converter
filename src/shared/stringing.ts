export interface StringingRow {
  id: string;
  source: "private" | "prostring";
  row: number;
  name: string;
  date?: string | null;
  collectionDate?: string | null;
  racquet?: string | null;
  main?: string | null;
  cross?: string | null;
  tension?: unknown;
  tensionMain?: unknown;
  tensionCross?: unknown;
  status?: string;
  payment?: string;
  customerPrice?: unknown;
  dueToMe?: unknown;
  cashHeld?: unknown;
  received?: unknown;
  overUnder?: unknown;
  stringCost?: unknown;
  labour?: unknown;
  notes?: string | null;
}

export interface StringingAdjustment {
  id: string;
  date: string;
  description: string;
  type: "supplied" | "purchase";
  amount: number;
}

export interface StringingSundry {
  id: string;
  date: string;
  description: string;
  direction: "ray-owes" | "dm-owes";
  complete: boolean;
}

export interface StringingState {
  rows: StringingRow[];
  adjustments: StringingAdjustment[];
  sundries: StringingSundry[];
}

export function isStringingState(value: unknown): value is StringingState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StringingState>;
  return Array.isArray(candidate.rows)
    && candidate.rows.every(isStringingRow)
    && Array.isArray(candidate.adjustments)
    && candidate.adjustments.every(isStringingAdjustment)
    && Array.isArray(candidate.sundries)
    && candidate.sundries.every(isStringingSundry);
}

function isStringingRow(value: unknown): value is StringingRow {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StringingRow>;
  return typeof candidate.id === "string"
    && (candidate.source === "private" || candidate.source === "prostring")
    && typeof candidate.row === "number"
    && typeof candidate.name === "string";
}

function isStringingAdjustment(value: unknown): value is StringingAdjustment {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StringingAdjustment>;
  return typeof candidate.id === "string"
    && typeof candidate.date === "string"
    && typeof candidate.description === "string"
    && (candidate.type === "supplied" || candidate.type === "purchase")
    && typeof candidate.amount === "number";
}

function isStringingSundry(value: unknown): value is StringingSundry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StringingSundry>;
  return typeof candidate.id === "string"
    && typeof candidate.date === "string"
    && typeof candidate.description === "string"
    && (candidate.direction === "ray-owes" || candidate.direction === "dm-owes")
    && typeof candidate.complete === "boolean";
}
