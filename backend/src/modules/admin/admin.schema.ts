import { z } from 'zod';

export const DATE_PRESETS = [
  'today',
  'yesterday',
  '7d',
  '1m',
  '6m',
  '1y',
  'ytd',
  'custom',
] as const;

export const dashboardQuerySchema = z
  .object({
    preset: z.enum(DATE_PRESETS).optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })
  .superRefine((data, ctx) => {
    const preset = data.preset ?? '7d';
    if (preset === 'custom' && (!data.from || !data.to)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'from and to are required when preset is custom',
        path: ['from'],
      });
    }
  });

export type DashboardQueryInput = z.infer<typeof dashboardQuerySchema>;

export const auditLogQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  userId: z.string().uuid().optional(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});
