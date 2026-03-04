import { z } from 'zod';

const isValidIsoDateString = (value) => {
  const isoDatePattern =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

  if (!isoDatePattern.test(value)) {
    return false;
  }

  const timestamp = Date.parse(value);
  return !Number.isNaN(timestamp);
};

export const listMatchesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const MATCH_STATUS = {
  SCHEDULED: 'scheduled',
  LIVE: 'live',
  FINISHED: 'finished',
};

export const matchIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const createMatchSchema = z
  .object({
    sport: z.string().trim().min(1),
    homeTeam: z.string().trim().min(1),
    awayTeam: z.string().trim().min(1),
    startTime: z
      .string()
      .refine(isValidIsoDateString, { message: 'startTime must be a valid ISO date string' }),
    endTime: z
      .string()
      .refine(isValidIsoDateString, { message: 'endTime must be a valid ISO date string' }),
    homeScore: z.coerce.number().int().nonnegative().optional(),
    awayScore: z.coerce.number().int().nonnegative().optional(),
  })
  .superRefine((value, context) => {
    const startTimestamp = Date.parse(value.startTime);
    const endTimestamp = Date.parse(value.endTime);

    if (Number.isNaN(startTimestamp) || Number.isNaN(endTimestamp)) {
      return;
    }

    if (endTimestamp <= startTimestamp) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endTime'],
        message: 'endTime must be after startTime',
      });
    }
  });

export const updateScoreSchema = z.object({
  homeScore: z.coerce.number().int().nonnegative(),
  awayScore: z.coerce.number().int().nonnegative(),
});
