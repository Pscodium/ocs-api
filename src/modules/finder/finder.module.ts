import type { Router } from 'express';
import type { AppModule } from '../../core/server/moduleRegistry';
import type { AppDeps } from '../../core/deps';
import { apiKeyValidator } from './http/finder.middleware';
import { createFinderController } from './http/finder.controller';

/**
 * Finder module — native TS port (docs §8 step 5). Backed by existing Sequelize
 * models through FinderRepository (the ORM boundary), so responses are identical
 * to the legacy controller; the Prisma swap later touches only the repository.
 *
 * Auth: static API key (not JWT). Canonical prefix '/finder'; legacyPrefixes ['']
 * remounts the SAME router at root so the original root paths (e.g.
 * GET /establishments) keep working — only host:port changes for consumers (docs §5).
 */
export const finderModule: AppModule = {
    name: 'finder',
    prefix: '/finder',
    legacyPrefixes: [''],
    register(router: Router, _deps: AppDeps): void {
        const c = createFinderController();
        router.use(apiKeyValidator);

        // Establishments
        router.get('/establishments', c.getEstablishments);
        router.get('/establishments/:id', c.getEstablishmentById);
        router.post('/establishments', c.createEstablishment);
        router.patch('/establishments/:id', c.updateEstablishment);
        router.put('/establishments/:id', c.updateEstablishment);
        router.delete('/establishments/:id', c.deleteEstablishment);

        // Products nested under an establishment
        router.get('/establishments/:establishmentId/products', c.getProductsByEstablishment);
        router.post('/establishments/:id/products', c.createProduct);
        router.patch('/establishments/:id/products/:productId', c.updateProduct);
        router.put('/establishments/:id/products/:productId', c.updateProduct);
        router.delete('/establishments/:id/products/:productId', c.deleteProduct);

        // Products by id (unscoped) — preserves legacy /finder/products/:id shape
        router.patch('/products/:id', c.updateProduct);
        router.put('/products/:id', c.updateProduct);
        router.delete('/products/:id', c.deleteProduct);

        // Categories + geocode
        router.get('/products/categories', c.getAllProductCategories);
        router.get('/establishments/product-categories', c.getAllProductCategories);
        router.get('/geocode/reverse', c.reverseGeocode);
    },
};
