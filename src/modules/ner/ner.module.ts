import type { Router } from 'express';
import type { AppModule } from '@core/server/moduleRegistry';
import type { AppDeps } from '@core/deps';
import { registerNerRoutes } from './http/ner.routes';

export const nerModule: AppModule = {
    name: 'ner',
    prefix: '/ner',
    register(router: Router, _deps: AppDeps): void {
        registerNerRoutes(router);
    },
};
