import type { Router } from 'express';
import { createNerController} from './ner.controller';
import { auth } from '@shared/middleware/auth.middleware';

export function registerNerRoutes(router: Router): void {
    const cn = createNerController();
    
    router.get('/labels', auth.apiKeyValidator, cn.getLabels);
    router.post('/mask', auth.apiKeyValidator, cn.mask);
    router.post('/mask/custom', auth.apiKeyValidator, cn.maskCustom);
}
