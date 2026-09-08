export interface Referrer {
    id: string;
    name: string;
    referralsPerReward: number;
    previouslyUsed?: number;
    historyNote?: string;
}
;
export interface ReferralOrder {
    id: string;
    source: string;
    name: string;
    referrerId?: string;
    rewardForId?: string;
    customerPrice?: unknown;
    received?: unknown;
    payment?: string;
    date?: string | null;
    row?: number;
    referralRedeemed?: boolean;
    referralRedeemedOn?: string;
    referralRewardOrderId?: string;
}
;
export const defaultReferrers: Referrer[] = [{ id: "referrer-cameron", name: "Cameron", referralsPerReward: 1 }];
export const clientKey = (name: string) => name.trim().replace(/\s+/g, " ").toLowerCase();
export function saveReferralOrder<T extends ReferralOrder>(rows: T[], order: T): T[] {
    if (order.source === "private" && order.referrerId === undefined) {
        const previous = rows.find(r => r.source === "private" && clientKey(r.name) === clientKey(order.name) && r.referrerId);
        order = { ...order, referrerId: previous?.referrerId, referralRedeemed: previous?.referralRedeemed, referralRedeemedOn: previous?.referralRedeemedOn, referralRewardOrderId: previous?.referralRewardOrderId };
    }
    const saved = order.source === "private" && order.rewardForId ? { ...order, customerPrice: 0, received: 0, payment: "Paid" } : order;
    const next = rows.some(r => r.id === saved.id) ? rows.map(r => r.id === saved.id ? saved : r) : [...rows, saved];
    return next.map(r => saved.source === "private" && r.source === "private" && clientKey(r.name) === clientKey(saved.name) ? { ...r, referrerId: saved.referrerId || "", referralRedeemed: saved.referralRedeemed, referralRedeemedOn: saved.referralRedeemedOn, referralRewardOrderId: saved.referralRewardOrderId } : r);
}
export function referredClients(rows: ReferralOrder[], referrer: Referrer) {
    const clients = new Map<string, ReferralOrder>();
    for (const row of rows)
        if (row.source === "private" && row.referrerId === referrer.id && clientKey(row.name) && clientKey(row.name) !== clientKey(referrer.name)) {
            const key = clientKey(row.name);
            const existing = clients.get(key);
            if (!existing || (row.date && (!existing.date || row.date < existing.date)))
                clients.set(key, row);
        }
    return [...clients.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export function referralTotals(rows: ReferralOrder[], referrer: Referrer) {
    const clients = [...new Set(rows.filter(r => r.source === "private" && r.referrerId === referrer.id && clientKey(r.name) && clientKey(r.name) !== clientKey(referrer.name)).map(r => clientKey(r.name)))];
    const earned = Math.floor(clients.length / referrer.referralsPerReward);
    const historical = referredClients(rows, referrer).filter(r => r.referralRedeemed && !rows.some(job => job.id === r.referralRewardOrderId && job.source === "private" && job.rewardForId === referrer.id)).length;
    const used = (referrer.previouslyUsed ?? 0) + historical + rows.filter(r => r.source === "private" && r.rewardForId === referrer.id).length;
    return { referred: clients.length, earned, used, owed: Math.max(0, earned - used), advance: Math.max(0, used - earned), untilNext: referrer.referralsPerReward - clients.length % referrer.referralsPerReward };
}
