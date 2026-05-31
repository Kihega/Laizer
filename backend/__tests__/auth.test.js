// SMSS — Auth route integration tests
const request = require('supertest');
const app     = require('../src/app');

describe('GET /api/health/', () => {
  it('returns 200 with status field', async () => {
    const res = await request(app).get('/api/health/').expect(200);
    expect(res.body.status).toBeDefined();
    expect(res.body.service).toBe('SMSS API');
  });
});

describe('POST /api/auth/owner/login/', () => {
  it('rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/auth/owner/login/')
      .send({})
      .expect(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('rejects non-existent email', async () => {
    const res = await request(app)
      .post('/api/auth/owner/login/')
      .send({ email: 'nobody@example.com', password: 'wrong' })
      .expect(401);
    expect(res.body.error).toBe('invalid_credentials');
  });
});

describe('POST /api/auth/worker/login/', () => {
  it('rejects missing centreId', async () => {
    const res = await request(app)
      .post('/api/auth/worker/login/')
      .send({})
      .expect(400);
    expect(res.body.error).toBe('validation_error');
  });

  it('rejects unknown centreId', async () => {
    const res = await request(app)
      .post('/api/auth/worker/login/')
      .send({ centreId: 'CENTRE-DOES-NOT-EXIST' })
      .expect(401);
    expect(res.body.error).toBe('invalid_centre_id');
  });
});

describe('Protected routes', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/centres/').expect(401);
    expect(res.body.error).toBe('unauthorized');
  });

  it('returns 401 for worker-only route without token', async () => {
    const res = await request(app).post('/api/stock/').expect(401);
    expect(res.body.error).toBe('unauthorized');
  });
});
