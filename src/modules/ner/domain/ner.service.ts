import { NerClient } from '@modules/ner/infra/ner.client';

export class NerService {
    constructor(private readonly client = new NerClient()) {}

    getLabels() {
        return this.client.getLabels();
    }

    mask(payload: Record<string, unknown>) {
        return this.client.mask(payload);
    }

    maskCustom(payload: Record<string, unknown>) {
        return this.client.maskCustom(payload);
    }
}
