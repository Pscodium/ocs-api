/** Serialization helpers for month categories/bills (ported from month.dto.js). */

type Row = Record<string, unknown>;

export function toBoolean(value: unknown): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value === 1;
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 't', 'yes', 'y'].includes(normalized)) return true;
        if (['0', 'false', 'f', 'no', 'n', ''].includes(normalized)) return false;
    }
    return Boolean(value);
}

function serializeCategory(row: Row, index: number): Record<string, unknown> {
    return {
        id: row.category_id || row.categoryId || row.id || null,
        categoryId: row.category_id || row.categoryId || row.id || null,
        name: row.name || row.categoryName || null,
        type: row.type || null,
        splitBy: row.split_by ?? row.splitBy ?? null,
        sortOrder: row.sort_order ?? row.sortOrder ?? index ?? null,
    };
}

function serializeBill(row: Row, index: number): Record<string, unknown> {
    return {
        id: row.id || null,
        categoryId: row.category_id || row.categoryId || null,
        name: row.name || row.title || null,
        type: row.type || null,
        amount: row.amount ?? row.value ?? null,
        dueDate: row.due_date || row.dueDate || row.date || null,
        paid: toBoolean(row.paid),
        sortOrder: row.sort_order ?? row.sortOrder ?? index ?? null,
    };
}

export function serializeCategoriesFromRows(rows: unknown): Record<string, unknown>[] {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.filter((row) => row && typeof row === 'object').map((row, index) => serializeCategory(row as Row, index));
}

export function serializeBillsFromRows(rows: unknown): Record<string, unknown>[] {
    if (!Array.isArray(rows) || rows.length === 0) return [];
    return rows.filter((row) => row && typeof row === 'object').map((row, index) => serializeBill(row as Row, index));
}
