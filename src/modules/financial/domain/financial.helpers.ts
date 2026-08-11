import { randomUUID } from 'node:crypto';
import { serializeBillsFromRows } from './month.dto';

/**
 * Pure normalization/serialization helpers for months (ported verbatim from
 * financial.controller.js). No DB access — safe to unit test.
 */
type Any = Record<string, unknown>;

export function parseMonthPayload(rawData: unknown): Any {
    if (!rawData) return {};
    if (typeof rawData === 'string') {
        try {
            return JSON.parse(rawData);
        } catch {
            return {};
        }
    }
    if (typeof rawData === 'object') return rawData as Any;
    return {};
}

export interface NormalizedCategory {
    category_id: string;
    legacy_category_id: string | null;
    name: string | null;
    type: string | null;
    split_by: number | null;
    sort_order: number;
}

export function normalizeCategories(categories: unknown): NormalizedCategory[] {
    if (!Array.isArray(categories)) return [];
    return categories
        .filter((item) => item && typeof item === 'object')
        .map((item: Any, index) => ({
            category_id: (item.categoryId || item.id || randomUUID()) as string,
            legacy_category_id: (item.categoryId || item.id || null) as string | null,
            name: (item.name || item.categoryName || null) as string | null,
            type: (item.type || null) as string | null,
            split_by: (item.splitBy ?? null) as number | null,
            sort_order: index,
        }));
}

export function flattenLegacyBills(monthData: Any): Any[] {
    if (!monthData || typeof monthData !== 'object') return [];
    const topLevelBills = Array.isArray(monthData.bills) ? (monthData.bills as Any[]) : [];
    const categoryBills = Array.isArray(monthData.categories)
        ? (monthData.categories as Any[]).flatMap((category: Any) => {
              if (!category || typeof category !== 'object' || !Array.isArray(category.bills)) return [];
              return (category.bills as Any[]).map((bill: Any) => ({
                  ...bill,
                  categoryId: bill?.categoryId || category.categoryId || category.id || null,
                  type: bill?.type || category.type || null,
              }));
          })
        : [];
    return [...topLevelBills, ...categoryBills].filter((bill) => bill && typeof bill === 'object');
}

export interface NormalizedBill {
    id: string;
    category_id: string | null;
    name: string | null;
    type: string | null;
    amount: unknown;
    due_date: unknown;
    paid: boolean;
    sort_order: number;
}

export function normalizeBills(bills: unknown, monthData: Any, categories: NormalizedCategory[]): NormalizedBill[] {
    const legacyToInternalCategoryId = new Map(
        (Array.isArray(categories) ? categories : [])
            .filter((c) => c.legacy_category_id)
            .map((c) => [c.legacy_category_id, c.category_id]),
    );
    const legacyCategoryType = new Map(
        (Array.isArray(categories) ? categories : [])
            .filter((c) => c.legacy_category_id)
            .map((c) => [c.legacy_category_id, c.type]),
    );

    const sourceBills = Array.isArray(bills) ? (bills as Any[]) : flattenLegacyBills(monthData);
    const sortCounterByCategory = new Map<string, number>();

    return sourceBills
        .filter((item) => item && typeof item === 'object')
        .map((item: Any) => {
            const categoryId =
                legacyToInternalCategoryId.get((item.categoryId || item.category_id || null) as string | null) || null;
            const counterKey = categoryId || '__unassigned__';
            const currentSort = sortCounterByCategory.get(counterKey) || 0;
            sortCounterByCategory.set(counterKey, currentSort + 1);

            return {
                id: (item.id || randomUUID()) as string,
                category_id: categoryId,
                name: (item.name || item.title || null) as string | null,
                type: (item.type || legacyCategoryType.get((item.categoryId || item.category_id || null) as string | null) || null) as string | null,
                amount: item.amount ?? item.value ?? null,
                due_date: item.dueDate || item.date || null,
                paid: Boolean(item.paid),
                sort_order: currentSort,
            };
        });
}

export function hasBillsWithoutCategory(bills: NormalizedBill[]): boolean {
    return Array.isArray(bills) && bills.some((bill) => !bill.category_id);
}

export function composeCategoriesWithBills(categories: unknown, bills: unknown, legacyCategories: unknown): Any[] {
    const normalizedCategories = Array.isArray(categories) ? (categories as Any[]) : [];
    const normalizedBills = serializeBillsFromRows(Array.isArray(bills) ? bills : []);
    const legacy = Array.isArray(legacyCategories) ? (legacyCategories as Any[]) : [];

    const billsByCategoryId = new Map<string, Any[]>();
    normalizedBills.forEach((bill: Any) => {
        const categoryId = (bill.categoryId || bill.category_id) as string | undefined;
        if (!categoryId) return;
        if (!billsByCategoryId.has(categoryId)) billsByCategoryId.set(categoryId, []);
        billsByCategoryId.get(categoryId)!.push(bill);
    });

    if (normalizedCategories.length > 0) {
        return normalizedCategories.map((category: Any, index) => {
            const categoryId = (category.id || category.categoryId || category.category_id) as string | undefined;
            const sortOrder = category.sortOrder ?? category.sort_order ?? index;
            const payload: Any = {
                id: categoryId,
                name: category.name || category.categoryName || null,
                type: category.type || null,
                sortOrder,
                bills: categoryId ? billsByCategoryId.get(categoryId) || [] : [],
            };
            const splitBy = category.splitBy ?? category.split_by;
            if (splitBy !== null && splitBy !== undefined) payload.splitBy = splitBy;
            return payload;
        });
    }

    if (legacy.length > 0) {
        return legacy.map((category: Any, index) => {
            const categoryId = (category?.id || category?.categoryId) as string | undefined;
            return {
                ...category,
                sortOrder: category?.sortOrder ?? index,
                bills: categoryId
                    ? billsByCategoryId.get(categoryId) || serializeBillsFromRows((category.bills as unknown[]) || [])
                    : serializeBillsFromRows((category.bills as unknown[]) || []),
            };
        });
    }

    return [];
}
