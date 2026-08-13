import z from "zod";

export const maskSchema = z.object({
    text: z.string(),
});

export const maskCustomSchema = z.object({
    text: z.string(),
    labels: z.array(z.string()),
});

export type MaskSchema = z.infer<typeof maskSchema>;
export type MaskCustomSchema = z.infer<typeof maskCustomSchema>;
