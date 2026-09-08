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
  referrerId?: string;
  rewardForId?: string;
  referralRedeemed?: boolean;
  referralRedeemedOn?: string;
  referralRewardOrderId?: string;
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
export interface StringingExpense {
  id: string;
  date: string;
  supplier: string;
  category: string;
  description: string;
  amount: number;
  notes?: string;
  receipt?: { name: string; key: string; contentType: string };
}
export interface StringingString {
  id: string;
  brand: string;
  name: string;
  gauge: string;
  type: string;
  costPerRacket: number;
  setCost?: number;
  reel100Cost?: number;
  reel200Cost?: number;
  purchaseFormat?: "set" | "100m" | "200m";
  priceToCustomer?: number;
  customerPriceOverride?: number | null;
  priceSource?: string;
  colour?: string;
  hardness?: string;
  characteristics?: string[];
  reelPriceUrl?: string;
  inStock?: boolean;
}

export interface StringingReferrer {
  id: string;
  name: string;
  referralsPerReward: number;
  previouslyUsed?: number;
  historyNote?: string;
}

export interface StringingState {
  referrers?: StringingReferrer[];
  rows: StringingRow[];
  adjustments: StringingAdjustment[];
  sundries: StringingSundry[];
  expenses?: StringingExpense[];
  strings?: StringingString[];
}

export function isStringingState(value: unknown): value is StringingState {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StringingState>;
  return (
    Array.isArray(candidate.rows) &&
    candidate.rows.every(isStringingRow) &&
    Array.isArray(candidate.adjustments) &&
    candidate.adjustments.every(isStringingAdjustment) &&
    Array.isArray(candidate.sundries) &&
    candidate.sundries.every(isStringingSundry) &&
    (candidate.referrers === undefined || (Array.isArray(candidate.referrers) && candidate.referrers.every(isStringingReferrer)))
  );
}

function isStringingRow(value: unknown): value is StringingRow {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StringingRow>;
  return (
    typeof candidate.id === "string" &&
    (candidate.source === "private" || candidate.source === "prostring") &&
    typeof candidate.row === "number" &&
    typeof candidate.name === "string"
  );
}

function isStringingAdjustment(value: unknown): value is StringingAdjustment {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StringingAdjustment>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.date === "string" &&
    typeof candidate.description === "string" &&
    (candidate.type === "supplied" || candidate.type === "purchase") &&
    typeof candidate.amount === "number"
  );
}

function isStringingSundry(value: unknown): value is StringingSundry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StringingSundry>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.date === "string" &&
    typeof candidate.description === "string" &&
    (candidate.direction === "ray-owes" || candidate.direction === "dm-owes") &&
    typeof candidate.complete === "boolean"
  );
}

function isStringingReferrer(value: unknown): value is StringingReferrer {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StringingReferrer>;
  return typeof candidate.id === "string" && typeof candidate.name === "string" && Number.isSafeInteger(candidate.referralsPerReward) && Number(candidate.referralsPerReward) > 0 && (candidate.previouslyUsed === undefined || (Number.isSafeInteger(candidate.previouslyUsed) && candidate.previouslyUsed >= 0));
}

export function wouldDiscardReferrals(current: StringingState | undefined, incoming: StringingState): boolean {
  return current?.referrers !== undefined && incoming.referrers === undefined;
}
