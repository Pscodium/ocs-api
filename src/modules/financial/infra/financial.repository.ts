import { prisma } from '../../../config/database';
import type { NormalizedBill, NormalizedCategory } from '../domain/financial.helpers';

/**
 * Financial repository on PRISMA (docs §8 step 6). Wraps months/categories/bills +
 * budgets/investments/goals/subscriptions. Replaces the legacy Sequelize controller
 * data access; query semantics (ordering, transactional replace) are preserved.
 */
const toDate = (v: unknown): Date | null => (v ? new Date(v as string) : null);

export class FinancialRepository {
    findMonth(userId: string, monthKey: string) {
        return prisma.month.findFirst({ where: { userId, month_key: monthKey } });
    }

    async createMonthWithData(
        userId: string,
        monthKey: string,
        categories: NormalizedCategory[],
        bills: NormalizedBill[],
    ) {
        return prisma.$transaction(async (tx) => {
            const created = await tx.month.create({ data: { month_key: monthKey, userId } });
            await tx.monthCategory.deleteMany({ where: { userId, month_key: monthKey } });
            if (categories.length) {
                await tx.monthCategory.createMany({ data: categories.map((c) => this.categoryRow(userId, monthKey, c)) });
            }
            await tx.monthBill.deleteMany({ where: { userId, month_key: monthKey } });
            if (bills.length) {
                await tx.monthBill.createMany({ data: bills.map((b) => this.billRow(userId, monthKey, b)) });
            }
            return created;
        });
    }

    async replaceCategories(userId: string, monthKey: string, categories: NormalizedCategory[]): Promise<void> {
        await prisma.$transaction(async (tx) => {
            await tx.monthCategory.deleteMany({ where: { userId, month_key: monthKey } });
            if (categories.length) {
                await tx.monthCategory.createMany({ data: categories.map((c) => this.categoryRow(userId, monthKey, c)) });
            }
        });
    }

    async replaceBills(userId: string, monthKey: string, bills: NormalizedBill[]): Promise<void> {
        await prisma.$transaction(async (tx) => {
            await tx.monthBill.deleteMany({ where: { userId, month_key: monthKey } });
            if (bills.length) {
                await tx.monthBill.createMany({ data: bills.map((b) => this.billRow(userId, monthKey, b)) });
            }
        });
    }

    private categoryRow(userId: string, monthKey: string, c: NormalizedCategory) {
        return {
            userId,
            month_key: monthKey,
            category_id: c.category_id,
            name: c.name,
            type: c.type,
            split_by: c.split_by,
            sort_order: c.sort_order,
        };
    }

    private billRow(userId: string, monthKey: string, b: NormalizedBill) {
        return {
            id: b.id,
            userId,
            month_key: monthKey,
            category_id: b.category_id,
            name: b.name,
            type: b.type,
            amount: b.amount as number | string | null,
            due_date: toDate(b.due_date),
            paid: b.paid,
            sort_order: b.sort_order,
        };
    }

    /** Legacy getMonths raw aggregation (JSON_ARRAYAGG). Single :userId -> ?. */
    getMonthsRaw(userId: string): Promise<Record<string, unknown>[]> {
        const sql = `SELECT
            M.*,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', C.CATEGORYID,'categoryId', C.CATEGORYID,'name', C.NAME,'type', C.TYPE,'splitBy', C.SPLITBY,'sortOrder', C.SORTORDER)) FROM month_categories C WHERE C.MONTHKEY = M.MONTHKEY AND C.USERID = M.USERID ORDER BY C.SORTORDER ASC) AS categories,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', MB.ID,'categoryId', MB.CATEGORYID,'name', MB.NAME,'type', MB.TYPE,'amount', MB.AMOUNT,'dueDate', MB.DUEDATE,'paid', MB.PAID,'sortOrder', MB.SORTORDER)) FROM month_bills MB WHERE MB.MONTHKEY = M.MONTHKEY AND MB.USERID = M.USERID ORDER BY MB.SORTORDER ASC) AS bills,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', B.ID,'categoryId', B.CATEGORYID,'categoryName', B.CATEGORYNAME,'limit', B.LIMIT,'spent', B.SPENT,'monthKey', B.MONTHKEY)) FROM budgets B WHERE B.MONTHKEY = M.MONTHKEY AND B.USERID = M.USERID) AS budgets,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', I.ID,'name', I.NAME,'type', I.TYPE,'amount', I.AMOUNT,'purchaseDate', I.PURCHASEDATE,'currentValue', I.CURRENTVALUE,'notes', I.NOTES)) FROM investments I WHERE I.MONTHKEY = M.MONTHKEY AND I.USERID = M.USERID) AS investments,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', G.ID,'name', G.NAME,'targetAmount', G.TARGETAMOUNT,'currentAmount', G.CURRENTAMOUNT,'deadline', G.DEADLINE,'category', G.CATEGORY)) FROM goals G WHERE G.MONTHKEY = M.MONTHKEY AND G.USERID = M.USERID) AS goals,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', S.ID,'name', S.NAME,'amount', S.AMOUNT,'billingCycle', S.BILLINGCYCLE,'nextBillingDate', S.NEXTBILLINGDATE,'category', S.CATEGORY,'active', S.ACTIVE,'notes', S.NOTES)) FROM subscriptions S WHERE S.USERID = M.USERID) AS subscriptions
            FROM month M WHERE M.USERID = ? ORDER BY M.MONTHKEY DESC;`;
        return prisma.$queryRawUnsafe<Record<string, unknown>[]>(sql, userId);
    }

    findCategories(userId: string, monthKey: string) {
        return prisma.monthCategory.findMany({
            where: { userId, month_key: monthKey },
            orderBy: [{ sort_order: 'asc' }, { createdAt: 'asc' }],
        });
    }

    findBills(userId: string, monthKey: string) {
        return prisma.monthBill.findMany({
            where: { userId, month_key: monthKey },
            orderBy: [{ category_id: 'asc' }, { sort_order: 'asc' }, { createdAt: 'asc' }],
        });
    }

    countCategories(userId: string, monthKey: string) {
        return prisma.monthCategory.count({ where: { userId, month_key: monthKey } });
    }

    findCategoryIds(userId: string, monthKey: string, ids: string[]) {
        return prisma.monthCategory.findMany({
            where: { userId, month_key: monthKey, category_id: { in: ids } },
            select: { category_id: true },
        });
    }

    async reorderCategories(userId: string, monthKey: string, orderedIds: string[]): Promise<void> {
        await prisma.$transaction(
            orderedIds.map((categoryId, index) =>
                prisma.monthCategory.updateMany({
                    where: { userId, month_key: monthKey, category_id: categoryId },
                    data: { sort_order: index },
                }),
            ),
        );
    }

    countBills(userId: string, monthKey: string, categoryId: string) {
        return prisma.monthBill.count({ where: { userId, month_key: monthKey, category_id: categoryId } });
    }

    findBillIds(userId: string, monthKey: string, categoryId: string, ids: string[]) {
        return prisma.monthBill.findMany({
            where: { userId, month_key: monthKey, category_id: categoryId, id: { in: ids } },
            select: { id: true },
        });
    }

    findCategory(userId: string, monthKey: string, categoryId: string) {
        return prisma.monthCategory.findFirst({ where: { userId, month_key: monthKey, category_id: categoryId } });
    }

    async reorderBills(userId: string, monthKey: string, categoryId: string, orderedIds: string[]): Promise<void> {
        await prisma.$transaction(
            orderedIds.map((billId, index) =>
                prisma.monthBill.updateMany({
                    where: { userId, month_key: monthKey, category_id: categoryId, id: billId },
                    data: { sort_order: index },
                }),
            ),
        );
    }

    async deleteMonthCascade(userId: string, monthKey: string): Promise<number> {
        await prisma.monthCategory.deleteMany({ where: { userId, month_key: monthKey } });
        await prisma.monthBill.deleteMany({ where: { userId, month_key: monthKey } });
        const { count } = await prisma.month.deleteMany({ where: { userId, month_key: monthKey } });
        return count;
    }

    // ---- Budgets ----
    findBudgets(userId: string, monthKey: string) {
        return prisma.budget.findMany({ where: { userId, month_key: monthKey }, orderBy: { createdAt: 'asc' } });
    }
    findBudget(userId: string, id: string) {
        return prisma.budget.findFirst({ where: { id, userId } });
    }
    findBudgetScoped(userId: string, monthKey: string, id: string) {
        return prisma.budget.findFirst({ where: { id, userId, month_key: monthKey } });
    }
    createBudget(data: Record<string, unknown>) {
        return prisma.budget.create({ data: data as never });
    }
    updateBudget(id: string, data: Record<string, unknown>) {
        return prisma.budget.update({ where: { id }, data: data as never });
    }
    async deleteBudget(userId: string, monthKey: string, id: string): Promise<number> {
        const { count } = await prisma.budget.deleteMany({ where: { id, userId, month_key: monthKey } });
        return count;
    }

    // ---- Investments ----
    findInvestments(userId: string, monthKey: string) {
        return prisma.investment.findMany({ where: { userId, month_key: monthKey }, orderBy: { createdAt: 'asc' } });
    }
    findInvestment(userId: string, id: string) {
        return prisma.investment.findFirst({ where: { id, userId } });
    }
    findInvestmentScoped(userId: string, monthKey: string, id: string) {
        return prisma.investment.findFirst({ where: { id, userId, month_key: monthKey } });
    }
    createInvestment(data: Record<string, unknown>) {
        return prisma.investment.create({ data: data as never });
    }
    updateInvestment(id: string, data: Record<string, unknown>) {
        return prisma.investment.update({ where: { id }, data: data as never });
    }
    async deleteInvestment(userId: string, monthKey: string, id: string): Promise<number> {
        const { count } = await prisma.investment.deleteMany({ where: { id, userId, month_key: monthKey } });
        return count;
    }

    // ---- Goals ----
    findGoals(userId: string, monthKey: string) {
        return prisma.goal.findMany({ where: { userId, month_key: monthKey }, orderBy: { createdAt: 'asc' } });
    }
    findGoal(userId: string, id: string) {
        return prisma.goal.findFirst({ where: { id, userId } });
    }
    findGoalScoped(userId: string, monthKey: string, id: string) {
        return prisma.goal.findFirst({ where: { id, userId, month_key: monthKey } });
    }
    createGoal(data: Record<string, unknown>) {
        return prisma.goal.create({ data: data as never });
    }
    updateGoal(id: string, data: Record<string, unknown>) {
        return prisma.goal.update({ where: { id }, data: data as never });
    }
    async deleteGoal(userId: string, monthKey: string, id: string): Promise<number> {
        const { count } = await prisma.goal.deleteMany({ where: { id, userId, month_key: monthKey } });
        return count;
    }

    // ---- Subscriptions ----
    findSubscriptions(userId: string, monthKey: string) {
        return prisma.subscription.findMany({ where: { userId, month_key: monthKey }, orderBy: { createdAt: 'asc' } });
    }
    findSubscription(userId: string, id: string) {
        return prisma.subscription.findFirst({ where: { id, userId } });
    }
    findSubscriptionScoped(userId: string, monthKey: string, id: string) {
        return prisma.subscription.findFirst({ where: { id, userId, month_key: monthKey } });
    }
    createSubscription(data: Record<string, unknown>) {
        return prisma.subscription.create({ data: data as never });
    }
    updateSubscription(id: string, data: Record<string, unknown>) {
        return prisma.subscription.update({ where: { id }, data: data as never });
    }
    async deleteSubscription(userId: string, monthKey: string, id: string): Promise<number> {
        const { count } = await prisma.subscription.deleteMany({ where: { id, userId, month_key: monthKey } });
        return count;
    }

    toDate = toDate;
}
