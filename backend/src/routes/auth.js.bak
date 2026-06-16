/**
 * SMSS — Auth routes
 *
 * POST /api/auth/owner/login/   — { email, password } → { access, refresh, user }
 * POST /api/auth/worker/login/  — { centreId }        → { access, refresh, user, centreId }
 * POST /api/auth/refresh/       — { refresh }
 * POST /api/auth/logout/        — { refresh }
 * GET  /api/auth/me/            — current user profile
 */
const { Router }       = require('express');
const { z }            = require('zod');
const bcrypt           = require('bcryptjs');
const prisma           = require('../lib/prisma');
const jwtLib           = require('../lib/jwt');
const redis            = require('../lib/redis');
const logAction        = require('../lib/audit');
const { authenticate } = require('../middleware/auth');

const router = Router();

// ── Helper: safe user profile (no password hash) ──────────────────────────────
function userProfile(u, centreId = null) {
  return {
    id:             u.id,
    fullName:       u.fullName,
    email:          u.email          || null,
    phone:          u.phone          || null,
    nim:            u.nim            || null,
    profilePicture: u.profilePicture || null,
    role:           u.role,
    isActive:       u.isActive,
    lastLogin:      u.lastLogin,
    centreId,
  };
}

// ── POST /api/auth/owner/register/ ──────────────────────────────────────────
// Public endpoint — creates an active owner account (can login immediately).
// brandName is stored in the `nim` field as an MVP workaround;
// add a dedicated `brandName` column in a future Prisma migration.
const RegisterSchema = z.object({
  fullName:  z.string().min(2, 'Full name required')
               .transform(s => s.trim().toUpperCase()),
  brandName: z.string().min(2, 'Brand name required')
               .transform(s => s.trim().toUpperCase()),
  phone:     z.string().min(7, 'Phone number required')
               .regex(/^[0-9+\s\-()]+$/, 'Invalid phone number format'),
  email:     z.string().email('Valid email required').optional(),
  password:  z.string().min(8, 'Password must be at least 8 characters'),
  profilePicture: z.string().optional(),  // base64 PNG from device
});

router.post('/owner/register/', async (req, res, next) => {
  try {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    const { fullName, brandName, phone, email, password, profilePicture } = parsed.data;

    // Uniqueness checks
    const phoneUsed = await prisma.user.findUnique({ where: { phone } });
    if (phoneUsed)
      return res.status(409).json({
        error:  'phone_exists',
        detail: 'This phone number is already registered. Contact support if this is an error.',
      });

    if (email) {
      const emailUsed = await prisma.user.findUnique({ where: { email } });
      if (emailUsed)
        return res.status(409).json({
          error:  'email_exists',
          detail: 'This email is already registered.',
        });
    }

    const brandUsed = await prisma.user.findUnique({ where: { nim: brandName } });
    if (brandUsed)
      return res.status(409).json({
        error:  'brand_exists',
        detail: 'A business with this brand name is already registered.',
      });

    // Create owner account — inactive until manually activated by admin
    const bcrypt      = require('bcryptjs');
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        fullName,
        phone,
        ...(email ? { email } : {}),
        nim:            brandName,  // nim stores brandName until a migration adds brandName column
        passwordHash,
        ...(profilePicture ? { profilePicture } : {}),
        role:           'owner',
        isActive:       true,       // owner can login immediately after registration
      },
    });

    await logAction(user.id, 'OWNER_REGISTER', { req, result: 'registered_active' });

    return res.status(201).json({
      success:  true,
      userId:   user.id,
      message:  'Registration successful! You can now sign in with your email and password.',
    });
  } catch (err) { next(err); }
});

// ── POST /api/auth/owner/login/ ───────────────────────────────────────────────
const OwnerLoginSchema = z.object({
  email:    z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});

router.post('/owner/login/', async (req, res, next) => {
  try {
    const parsed = OwnerLoginSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.role !== 'owner' || !user.isActive) {
      await logAction(null, 'OWNER_LOGIN_FAILURE', { req, result: 'not_found' });
      return res.status(401).json({ error: 'invalid_credentials', detail: 'Email not found or account inactive.' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash || '');
    if (!valid) {
      await logAction(user.id, 'OWNER_LOGIN_FAILURE', { req, result: 'wrong_password' });
      return res.status(401).json({ error: 'invalid_credentials', detail: 'Incorrect password.' });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } });
    await redis.cacheDel(redis.CacheKey.user(user.id));

    const access             = jwtLib.signAccess(user);
    const { token: refresh } = jwtLib.signRefresh(user);

    await logAction(user.id, 'OWNER_LOGIN_SUCCESS', { req, result: 'success' });
    return res.json({ access, refresh, user: userProfile(user) });
  } catch (err) { next(err); }
});

// ── POST /api/auth/worker/login/ ──────────────────────────────────────────────
const WorkerLoginSchema = z.object({
  centreId: z.string().min(1, 'Centre ID required'),
});

router.post('/worker/login/', async (req, res, next) => {
  try {
    const parsed = WorkerLoginSchema.safeParse(req.body);
    if (!parsed.success)
      return res.status(400).json({ error: 'validation_error', detail: parsed.error.flatten() });

    const { centreId } = parsed.data;

    // Verify centre exists and is active
    const centre = await prisma.centre.findUnique({ where: { centreId } });
    if (!centre || !centre.isActive) {
      await logAction(null, 'WORKER_LOGIN_FAILURE', { req, result: 'centre_not_found', centreId });
      return res.status(401).json({
        error: 'invalid_centre_id',
        detail: 'Centre ID not found. Check with your employer.',
      });
    }

    // Find an active worker assigned to this centre
    // For MVP: if multiple workers share a login, we return the first active one.
    // In production, each worker would have their own pin or NIM + centreId combo.
    const assignment = await prisma.workerCentreAssignment.findFirst({
      where:   { centreId: centre.id, isActive: true },
      include: { worker: true },
      orderBy: { assignedAt: 'asc' },
    });

    if (!assignment || !assignment.worker.isActive) {
      await logAction(null, 'WORKER_LOGIN_FAILURE', { req, result: 'no_workers', centreId });
      return res.status(401).json({
        error: 'no_workers_assigned',
        detail: 'No active workers assigned to this centre. Contact the owner.',
      });
    }

    const worker = assignment.worker;
    await prisma.user.update({ where: { id: worker.id }, data: { lastLogin: new Date() } });
    await redis.cacheDel(redis.CacheKey.user(worker.id));

    const access             = jwtLib.signAccess({ ...worker, centreId: centre.id });
    const { token: refresh } = jwtLib.signRefresh(worker);

    await logAction(worker.id, 'WORKER_LOGIN_SUCCESS', { req, result: 'success', centreId });
    const owner = await prisma.user.findUnique({ where: { id: centre.ownerId }, select: { nim:true, profilePicture:true } });
    const centreInfo = { name: centre.name, location: centre.location, centreId: centre.centreId,
      brandName: owner?.nim ?? 'LAIZER STATIONERY', profilePicture: owner?.profilePicture ?? null };
    return res.json({ access, refresh, user: userProfile(worker, centre.id), centreInfo });
  } catch (err) { next(err); }
});

// ── POST /api/auth/refresh/ ───────────────────────────────────────────────────
router.post('/refresh/', async (req, res, next) => {
  try {
    const { refresh } = req.body;
    if (!refresh) return res.status(400).json({ error: 'refresh_required' });

    let payload;
    try { payload = jwtLib.verify(refresh); }
    catch { return res.status(401).json({ error: 'invalid_token' }); }

    if (await jwtLib.isBlacklisted(payload.jti))
      return res.status(401).json({ error: 'token_blacklisted' });

    await jwtLib.blacklist(payload.jti, payload.exp);

    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive)
      return res.status(401).json({ error: 'unauthorized' });

    const access               = jwtLib.signAccess(user);
    const { token: newRefresh } = jwtLib.signRefresh(user);
    return res.json({ access, refresh: newRefresh });
  } catch (err) { next(err); }
});

// ── POST /api/auth/logout/ ────────────────────────────────────────────────────
router.post('/logout/', async (req, res, next) => {
  try {
    const { refresh } = req.body;
    if (!refresh) return res.status(400).json({ error: 'refresh_required' });
    let payload;
    try { payload = jwtLib.verify(refresh); } catch { return res.json({ detail: 'Logged out.' }); }
    if (!(await jwtLib.isBlacklisted(payload.jti))) await jwtLib.blacklist(payload.jti, payload.exp);
    return res.json({ detail: 'Logged out successfully.' });
  } catch (err) { next(err); }
});

// ── GET /api/auth/me/ ─────────────────────────────────────────────────────────
router.get('/me/', authenticate, (req, res) =>
  res.json(userProfile(req.user, req.user.centreId))
);

// ── PATCH /api/auth/change-password/ ────────────────────────────────────────
// Authenticated endpoint — owner changes their own password.
router.patch('/change-password/', authenticate, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'validation_error', detail: 'Both currentPassword and newPassword are required.' });
    if (newPassword.length < 8)
      return res.status(400).json({ error: 'validation_error', detail: 'New password must be at least 8 characters.' });

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'not_found' });

    const bcrypt = require('bcryptjs');
    const ok = await bcrypt.compare(currentPassword, user.passwordHash || '');
    if (!ok)
      return res.status(401).json({ error: 'invalid_password', detail: 'Current password is incorrect.' });

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: req.user.id }, data: { passwordHash } });
    await logAction(req.user.id, 'PASSWORD_CHANGED', { req, result: 'success' });
    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (err) { next(err); }
});

module.exports = router;
