import type { Router } from 'express';
import { createNerController} from './ner.controller';
import { auth } from '@shared/middleware/auth.middleware';

export function registerNerRoutes(router: Router): void {
    const cn = createNerController();
    router.use(auth.apiKeyValidator);
    
    router.get('/labels', cn.getLabels);
    router.post('/mask', cn.mask);
    router.post('/mask/custom', cn.maskCustom);
}
