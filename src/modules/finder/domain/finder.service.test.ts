import { describe, expect, it, vi } from 'vitest';
import { HttpError } from '../../../core/http/httpError';
import { FinderService } from './finder.service';
import type { FinderRepository } from '../infra/finder.repository';

function repoMock(overrides: Partial<Record<keyof FinderRepository, unknown>> = {}) {
    return {
        listEstablishments: vi.fn(),
        getEstablishmentById: vi.fn(),
        findEstablishment: vi.fn(),
        createEstablishment: vi.fn(),
        updateEstablishment: vi.fn(),
        deleteEstablishment: vi.fn(),
        listProducts: vi.fn(),
        createProduct: vi.fn(),
        findProduct: vi.fn(),
        updateProduct: vi.fn(),
        deleteProduct: vi.fn(),
        distinctCategories: vi.fn(),
        ...overrides,
    } as unknown as FinderRepository;
}

const svc = (repo: FinderRepository) => new FinderService(repo);

describe('FinderService', () => {
    it('getEstablishment throws 404 with legacy message', async () => {
        const s = svc(repoMock({ getEstablishmentById: vi.fn().mockResolvedValue(null) }));
        await expect(s.getEstablishment('x')).rejects.toMatchObject({
            status: 404,
            message: 'Estabelecimento não encontrado',
        });
    });

    it('createEstablishment rejects when id is present', async () => {
        const s = svc(repoMock());
        await expect(s.createEstablishment({ id: '1', name: 'a' })).rejects.toBeInstanceOf(HttpError);
        await expect(s.createEstablishment({ id: '1' })).rejects.toMatchObject({
            message: 'id não deve ser enviado no payload de criação',
        });
    });

    it('createEstablishment enforces required fields', async () => {
        const s = svc(repoMock());
        await expect(s.createEstablishment({ name: 'a' })).rejects.toMatchObject({
            status: 400,
            message: 'name, category, description, address, latitude e longitude são obrigatórios',
        });
    });

    it('createEstablishment persists valid payload', async () => {
        const create = vi.fn().mockResolvedValue({ id: 'new' });
        const s = svc(repoMock({ createEstablishment: create }));
        const out = await s.createEstablishment({
            name: 'a', category: 'c', description: 'd', address: 'ad', latitude: 1, longitude: 2,
        });
        expect(out).toEqual({ id: 'new' });
        expect(create).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'a', latitude: 1, longitude: 2 }),
        );
    });

    it('updateEstablishment keeps existing values when payload fields are null/undefined', async () => {
        const current = { name: 'old', latitude: 1, longitude: 2, category: 'c', description: 'd', address: 'a' };
        const update = vi.fn().mockResolvedValue(current);
        const s = svc(repoMock({ findEstablishment: vi.fn().mockResolvedValue(current), updateEstablishment: update }));
        await s.updateEstablishment('id', { name: 'new', category: null });
        expect(update).toHaveBeenCalledWith('id', expect.objectContaining({ name: 'new', category: 'c' }));
    });

    it('createProduct 404s when establishment missing', async () => {
        const s = svc(repoMock({ findEstablishment: vi.fn().mockResolvedValue(null) }));
        await expect(
            s.createProduct('e', { name: 'n', category: 'c', description: 'd' }),
        ).rejects.toMatchObject({ status: 404, message: 'Estabelecimento não encontrado' });
    });

    it('deleteProduct 404s when nothing deleted', async () => {
        const s = svc(repoMock({ deleteProduct: vi.fn().mockResolvedValue(0) }));
        await expect(s.deleteProduct({ id: 'x' })).rejects.toMatchObject({ status: 404 });
    });

    it('reverseGeocode validates lat/lng presence and type', async () => {
        const s = svc(repoMock());
        await expect(s.reverseGeocode(null, 1)).rejects.toMatchObject({ message: 'lat e lng são obrigatórios' });
        await expect(s.reverseGeocode('abc', '2')).rejects.toMatchObject({ message: 'lat e lng devem ser numéricos' });
    });
});
