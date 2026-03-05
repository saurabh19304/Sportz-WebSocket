import { Router } from "express";
import { createMatchSchema, listMatchesQuerySchema } from "../validation/matches.js";
import { matches } from "../db/schema.js";
import { db } from "../db/db.js";
import { getMatchStatus } from "../utils/match-status.js";
import { desc } from "drizzle-orm";

export const matchRouter = Router();

const MAX_LIMIT = 100;

matchRouter.get('/' ,  async (req, res) => {
  const parsed = listMatchesQuerySchema.safeParse(req.query);

  if(!parsed.success){
   return res.status(400).json({error: 'invalid query', details:  parsed.error.issues}); 
  }

  const limit = Math.min(parsed.data.limit ?? 50 , MAX_LIMIT);

try {
    const data = await db
    .select()
    .from(matches)
    .orderBy((desc(matches.createdAt)))
    .limit(limit)

     res.json({data})
} catch (e) {

   res.status(500).json({ error: 'failed to list matches', details: JSON.stringify(e)})
}
})

matchRouter.post('/',  async (req,res) => {
  const parsed = createMatchSchema.safeParse(req.body); //this make sure that the body we are passing match the schema safeparse through zod function
  

  if(!parsed.success){
   return res.status(400).json({error: 'invalid payload', details: parsed.error.issues}); 
  }

const {data : { startTime, endTime , homeScore , awayScore }} = parsed;

  try {
    const [event] = await db.insert(matches).values({
      ...parsed.data, 
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      homeScore: homeScore ?? 0,
      awayScore: awayScore ??  0,
      status : getMatchStatus(startTime, endTime )
    }).returning()  //.returning() tells the database to give back the inserted/updated record after the operation.

      if(req.app.locals.broadcastMatchCreated){
        req.app.locals.broadcastMatchCreated(event);
      }

  res.status(201).json( {data: event});

  } catch (e) {
    res.status(500).json({ error: 'failed to create a match', etails: e.message })
  }
})   