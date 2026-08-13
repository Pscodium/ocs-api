import { env } from '@config/env';
import { HttpError } from '@core/http/httpError';


export class NerClient {
    constructor(
        private readonly baseUrl = env.NER_API_URL,
        private readonly apiKey = env.NER_API_KEY,
        private readonly timeoutMs = Number(env.NER_API_TIMEOUT_MS ?? 10_000),
    ) {}

    getLabels(): Promise<unknown> {
        return this.request('GET', '/labels');
    }

    mask(payload: Record<string, unknown>): Promise<unknown> {
        return this.request('POST', '/mask', payload);
    }

    maskCustom(payload: Record<string, unknown>): Promise<unknown> {
        return this.request('POST', '/mask/custom', payload);
    }

    private async request(
        method: 'GET' | 'POST',
        path: string,
        body?: Record<string, unknown>,
    ): Promise<unknown> {
        if (!this.baseUrl) {
            throw HttpError.internal('NER_API_URL não configurada');
        }
        if (!this.apiKey) {
            throw HttpError.internal('NER_API_KEY não configurada');
        }

        let res: Response;
        try {
            res = await fetch(`${this.baseUrl}${path}`, {
                method,
                headers: {
                    Accept: 'application/json',
                    'X-API-Key': this.apiKey,
                    ...(body ? { 'Content-Type': 'application/json' } : {}),
                },
                body: body ? JSON.stringify(body) : undefined,
                signal: AbortSignal.timeout(this.timeoutMs),
            });
        } catch (e) {
            if (e instanceof Error && e.name === 'TimeoutError') {
                throw new HttpError(504, 'Tempo limite no serviço de NER');
            }
            throw new HttpError(502, 'Falha ao conectar no serviço de NER');
        }

        if (!res.ok) {
            throw new HttpError(res.status, 'Falha no serviço de NER');
        }
        return res.json();
    }
}
