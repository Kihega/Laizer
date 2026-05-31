/**
 * SMSS — Push Token route
 * POST /api/push-token/  — worker saves/refreshes their Expo push token on login
 */
const { Router }    = require('express');
const { z }         = require('zod');
const prisma        = require('../lib/prisma');
const { authenticate } = require('../middleware/auth');

const router = Router();
router.use(authenticate);

const Schema = z.object({
  token:    z.string().min(1),
  platform: z.enum(['ios', 'android']).optional(),
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = Schema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    await prisma.expoPushToken.upsert({
      where:  { token: parsed.data.token },
      create: { userId: req.user.id, ...parsed.data },
      update: { userId: req.user.id, platform: parsed.data.platform },
    });
    return res.json({ detail: 'Push token saved.' });
  } catch (err) { next(err); }
});

module.exports = router;
