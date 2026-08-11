import { HttpError } from '../../../core/http/httpError';
import { FinderRepository, type EstablishmentData, type ProductData } from '../infra/finder.repository';

export interface ProductWhere {
    id: string;
    establishmentId?: string;
}

/**
 * Finder business logic. Validation messages and status codes are preserved
 * verbatim from the legacy controller (docs §1.4 zero behavior change). Domain
 * failures are raised as HttpError; the controller renders them in the legacy
 * `{ error: message }` shape.
 */
export class FinderService {
    constructor(private readonly repo = new FinderRepository()) {}

    listEstablishments() {
        return this.repo.listEstablishments();
    }

    async getEstablishment(id: string) {
        const found = await this.repo.getEstablishmentById(id);
        if (!found) throw HttpError.notFound('Estabelecimento não encontrado');
        return found;
    }

    async createEstablishment(payload: Record<string, unknown>) {
        if (payload.id != null) {
            throw HttpError.badRequest('id não deve ser enviado no payload de criação');
        }
        if (
            !payload.name ||
            !payload.category ||
            !payload.description ||
            !payload.address ||
            payload.latitude == null ||
            payload.longitude == null
        ) {
            throw HttpError.badRequest(
                'name, category, description, address, latitude e longitude são obrigatórios',
            );
        }
        const data: EstablishmentData = {
            name: payload.name as string,
            latitude: payload.latitude as number | string,
            longitude: payload.longitude as number | string,
            category: payload.category as string,
            description: payload.description as string,
            address: payload.address as string,
        };
        return this.repo.createEstablishment(data);
    }

    async updateEstablishment(id: string, payload: Record<string, unknown>) {
        const current = await this.repo.findEstablishment(id);
        if (!current) throw HttpError.notFound('Estabelecimento não encontrado');
        // `payload.x ?? current` — keep existing when null/undefined.
        const patch: Partial<EstablishmentData> = {
            name: (payload.name as string) ?? current.name,
            latitude: (payload.latitude as number | string) ?? current.latitude.toString(),
            longitude: (payload.longitude as number | string) ?? current.longitude.toString(),
            category: (payload.category as string) ?? current.category,
            description: (payload.description as string) ?? current.description,
            address: (payload.address as string) ?? current.address,
        };
        return this.repo.updateEstablishment(id, patch);
    }

    async deleteEstablishment(id: string): Promise<void> {
        const deleted = await this.repo.deleteEstablishment(id);
        if (!deleted) throw HttpError.notFound('Estabelecimento não encontrado');
    }

    listProducts(establishmentId: string) {
        return this.repo.listProducts(establishmentId);
    }

    async createProduct(establishmentId: string, payload: Record<string, unknown>) {
        if (payload.id != null) {
            throw HttpError.badRequest('id não deve ser enviado no payload de criação');
        }
        if (!payload.name || !payload.category || !payload.description) {
            throw HttpError.badRequest('name, category e description são obrigatórios');
        }
        const establishment = await this.repo.findEstablishment(establishmentId);
        if (!establishment) throw HttpError.notFound('Estabelecimento não encontrado');

        const data: ProductData = {
            name: payload.name as string,
            description: payload.description as string,
            category: payload.category as string,
            stock: (payload.stock as number | null | undefined) ?? null,
        };
        return this.repo.createProduct(establishmentId, data);
    }

    async updateProduct(where: ProductWhere, payload: Record<string, unknown>) {
        const product = await this.repo.findProduct(where);
        if (!product) throw HttpError.notFound('Produto não encontrado');
        const patch: Partial<ProductData> = {
            name: (payload.name as string) ?? product.name,
            description: (payload.description as string) ?? product.description,
            category: (payload.category as string) ?? product.category,
            stock: (payload.stock as number | null) ?? product.stock,
        };
        return this.repo.updateProduct(product.id, patch);
    }

    async deleteProduct(where: ProductWhere): Promise<void> {
        const deleted = await this.repo.deleteProduct(where);
        if (!deleted) throw HttpError.notFound('Produto não encontrado');
    }

    getCategories() {
        return this.repo.distinctCategories();
    }

    async reverseGeocode(lat: unknown, lng: unknown): Promise<unknown> {
        if (lat == null || lng == null) {
            throw HttpError.badRequest('lat e lng são obrigatórios');
        }
        const parsedLat = Number(lat);
        const parsedLng = Number(lng);
        if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
            throw HttpError.badRequest('lat e lng devem ser numéricos');
        }
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${parsedLat}&lon=${parsedLng}`,
            { headers: { Accept: 'application/json', 'User-Agent': 'ocs-api/1.0' } },
        );
        if (!response.ok) {
            throw new HttpError(response.status, 'Falha no serviço de geocoding reverso');
        }
        return response.json();
    }
}
