import { Router } from 'express';
import { matchIdParamSchema } from '../validation/matches.js';
import { createCommentarySchema, listCommentaryQuerySchema } from '../validation/commentary.js';
import { commentary } from '../db/schema.js';
import { db } from '../db/db.js';
import { desc, eq } from 'drizzle-orm';

export const commentaryRouter = Router({ mergeParams: true });

const MAX_LIMIT = 100;

commentaryRouter.get('/', async (req, res) => {
  const paramsParsed = matchIdParamSchema.safeParse(req.params);

  if (!paramsParsed.success) {
    return res.status(400).json({ error: 'invalid match id', details: paramsParsed.error.issues });
  }

  const queryParsed = listCommentaryQuerySchema.safeParse(req.query);

  if (!queryParsed.success) {
    return res.status(400).json({ error: 'invalid query', details: queryParsed.error.issues });
  }

  const limit = Math.min(queryParsed.data.limit ?? 100, MAX_LIMIT);

  try {
    const data = await db
      .select()
      .from(commentary)
      .where(eq(commentary.matchId, paramsParsed.data.id))
      .orderBy(desc(commentary.createdAt))
      .limit(limit);

    res.json({ data });
  } catch (e) {
    console.error('failed to list commentary', e);
    res.status(500).json({ error: 'failed to list commentary' });
  }
})

commentaryRouter.post('/', async (req, res) => {
  const paramsParsed = matchIdParamSchema.safeParse(req.params);

  if (!paramsParsed.success) {
    return res.status(400).json({ error: 'invalid match id', details: paramsParsed.error.issues });
  }

  const bodyParsed = createCommentarySchema.safeParse(req.body);

  if (!bodyParsed.success) {
    return res.status(400).json({ error: 'invalid payload', details: bodyParsed.error.issues });
  }

  try {
    const [entry] = await db
      .insert(commentary)
      .values({
        ...bodyParsed.data,
        matchId: paramsParsed.data.id,
      })
      .returning();

      try {
     req.app.locals.broadcastCommentry?.(entry.matchId, entry);
   } catch (broadcastError) {
     console.error('failed to broadcast commentary', broadcastError);
   }

    res.status(201).json({ data: entry });
  } catch (e) {
    console.error('failed to list commentary', e);
    res.status(500).json({ error: 'failed to list commentary' });
  }
})