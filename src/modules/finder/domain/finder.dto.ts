import { z } from 'zod';

/**
 * Finder DTOs. Validation mirrors the legacy controller's manual checks exactly
 * to avoid behavior changes (docs §1.4): required-field errors and the "id must
 * not be sent on create" guard keep their original messages/semantics.
 */

export const createEstablishmentBody = z.object({
    name: z.string(),
    category: z.string(),
    description: z.string(),
    address: z.string(),
    latitude: z.union([z.number(), z.string()]),
    longitude: z.union([z.number(), z.string()]),
});
export type CreateEstablishmentBody = z.infer<typeof createEstablishmentBody>;

export const updateEstablishmentBody = z
    .object({
        name: z.string().optional(),
        category: z.string().optional(),
        description: z.string().optional(),
        address: z.string().optional(),
        latitude: z.union([z.number(), z.string()]).optional(),
        longitude: z.union([z.number(), z.string()]).optional(),
    })
    .passthrough();
export type UpdateEstablishmentBody = z.infer<typeof updateEstablishmentBody>;

export const createProductBody = z.object({
    name: z.string(),
    category: z.string(),
    description: z.string(),
    stock: z.number().int().nullable().optional(),
});
export type CreateProductBody = z.infer<typeof createProductBody>;

export const updateProductBody = z
    .object({
        name: z.string().optional(),
        category: z.string().optional(),
        description: z.string().optional(),
        stock: z.number().int().nullable().optional(),
    })
    .passthrough();
export type UpdateProductBody = z.infer<typeof updateProductBody>;

export const reverseGeocodeQuery = z.object({
    lat: z.coerce.number(),
    lng: z.coerce.number(),
});
