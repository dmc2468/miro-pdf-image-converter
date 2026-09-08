interface SearchableOrder {
    name: string;
    racquet?: string | null;
    main?: string | null;
    cross?: string | null;
}
;
const cleanName = (name: string) => name.replace(/\s*\(from\s+[^)]*\)/gi, "").trim().replace(/\s+/g, " ").toLowerCase();
export function searchOrders<T extends SearchableOrder>(rows: T[], query: string): T[] {
    const term = query.trim().replace(/\s+/g, " ").toLowerCase();
    if (!term)
        return rows;
    const exact = rows.filter(row => cleanName(row.name) === term || row.name.trim().toLowerCase() === term);
    if (exact.length)
        return exact;
    const clients = rows.filter(row => cleanName(row.name).includes(term));
    if (clients.length)
        return clients;
    return rows.filter(row => [row.racquet, row.main, row.cross].some(value => value?.toLowerCase().includes(term)));
}
