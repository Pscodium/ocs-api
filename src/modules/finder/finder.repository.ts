import { prisma } from '../../config/database';

/**
 * ORM boundary for finder — now backed by PRISMA (docs §8 step 3/9; ORM decision
 * locked §9). This is the first module migrated off Sequelize. Service/controller
 * are unchanged above this boundary.
 *
 * ⚠️ Serialization note vs the legacy Sequelize controller: Prisma returns Decimal
 * (latitude/longitude) and Date objects; JSON.stringify renders Decimal as string
 * and Date as ISO — close to, but verify against, the legacy shape after db:pull.
 */
export interface EstablishmentData {
    name: string;
    latitude: number | string;
    longitude: number | string;
    category: string;
    description: string;
    address: string;
}

export interface ProductData {
    name: string;
    description: string;
    category: string;
    stock: number | null;
}

const productOrder = { orderBy: { id: 'asc' as const } };

export class FinderRepository {
    listEstablishments() {
        return prisma.establishments.findMany({
            include: { products: productOrder },
            orderBy: { id: 'asc' },
        });
    }

    getEstablishmentById(id: string) {
        return prisma.establishments.findUnique({
            where: { id },
            include: { products: productOrder },
        });
    }

    findEstablishment(id: string) {
        return prisma.establishments.findUnique({ where: { id } });
    }

    createEstablishment(data: EstablishmentData) {
        return prisma.establishments.create({ data });
    }

    updateEstablishment(id: string, data: Partial<EstablishmentData>) {
        return prisma.establishments.update({ where: { id }, data });
    }

    async deleteEstablishment(id: string): Promise<number> {
        const { count } = await prisma.establishments.deleteMany({ where: { id } });
        return count;
    }

    listProducts(establishmentId: string) {
        return prisma.establishmentProducts.findMany({
            where: { establishmentId },
            orderBy: { id: 'asc' },
        });
    }

    createProduct(establishmentId: string, data: ProductData) {
        return prisma.establishmentProducts.create({ data: { establishmentId, ...data } });
    }

    findProduct(where: { id: string; establishmentId?: string }) {
        return prisma.establishmentProducts.findFirst({ where });
    }

    updateProduct(id: string, data: Partial<ProductData>) {
        return prisma.establishmentProducts.update({ where: { id }, data });
    }

    async deleteProduct(where: { id: string; establishmentId?: string }): Promise<number> {
        const { count } = await prisma.establishmentProducts.deleteMany({ where });
        return count;
    }

    async distinctCategories(): Promise<string[]> {
        const rows = await prisma.establishmentProducts.findMany({
            distinct: ['category'],
            orderBy: { category: 'asc' },
            select: { category: true },
        });
        return rows.map((r) => r.category).filter((c): c is string => Boolean(c));
    }
}
