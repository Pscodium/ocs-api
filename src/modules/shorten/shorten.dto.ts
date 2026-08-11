import { z } from 'zod';

// Legacy behavior only required presence (not a valid URL); keep it lenient to
// avoid a behavior change during migration (docs/refactor-typescript.md §1.4).
export const shortenUrlBody = z.object({
    url: z.string({ error: 'URL é obrigatória' }).min(1, 'URL é obrigatória'),
});
export type ShortenUrlBody = z.infer<typeof shortenUrlBody>;

export const listUrlsQuery = z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().default(10),
});
export type ListUrlsQuery = z.infer<typeof listUrlsQuery>;

export interface UrlRecord {
    code: string;
    original: string;
    shortUrl: string;
    clicks: number;
    createdAt: number;
}

export interface PaginatedUrls {
    data: UrlRecord[];
    page: number;
    totalPages: number;
    totalItems: number;
}
