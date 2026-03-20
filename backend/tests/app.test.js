// ============================================================
//  SDUCS – MK  |  Backend Tests (Jest + Supertest)
// ============================================================
const request = require('supertest');
const mongoose = require('mongoose');
const app     = require('../server');
const User    = require('../models/User');

// ── Setup / Teardown ─────────────────────────────────────────
beforeAll(async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/sducs-test';
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
});

afterEach(async () => {
  await User.deleteMany({});
});

// ── Health Check ──────────────────────────────────────────────
describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('SDUCS-MK Backend');
  });
});

// ── Auth Routes ───────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('rejects missing email/password', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('rejects short password', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ email: 'test@example.com', password: '123' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects invalid email', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'password123' });
    expect([400, 500]).toContain(res.statusCode);
  });
});

describe('POST /api/auth/login', () => {
  it('rejects missing credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.statusCode).toBe(400);
  });

  it('rejects non-existent user', async () => {
    const res = await request(app).post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' });
    expect(res.statusCode).toBe(401);
  });
});

// ── Protected Routes ─────────────────────────────────────────
describe('Protected routes', () => {
  it('GET /api/auth/me returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/files returns 401 without token', async () => {
    const res = await request(app).get('/api/files');
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/ads/status returns 401 without token', async () => {
    const res = await request(app).get('/api/ads/status');
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/payments/create-order returns 401 without token', async () => {
    const res = await request(app).post('/api/payments/create-order').send({ plan: 'lite' });
    expect(res.statusCode).toBe(401);
  });
});

// ── Payment Plan Validation ───────────────────────────────────
describe('Payment plan validation', () => {
  it('rejects invalid plan without auth (expects 401, not 400)', async () => {
    const res = await request(app).post('/api/payments/create-order')
      .send({ plan: 'invalid_plan' });
    expect(res.statusCode).toBe(401); // auth fails before plan validation
  });
});

// ── Encryption Utility ────────────────────────────────────────
describe('Encryption utilities', () => {
  const { encryptBuffer, decryptBuffer, hashBuffer, generateAccessCode, hashAccessCode, verifyAccessCode } = require('../utils/encryption');

  it('encrypts and decrypts a buffer correctly', () => {
    const original = Buffer.from('Hello, SDUCS-MK!');
    const fileId = 'test-file-id-12345';
    const masterKey = 'test-master-key-must-be-long-enough!!';
    const { encryptedBuffer } = encryptBuffer(original, masterKey, fileId);
    const decrypted = decryptBuffer(encryptedBuffer, masterKey, fileId);
    expect(decrypted.toString()).toBe(original.toString());
  });

  it('produces consistent SHA-256 hash', () => {
    const buf = Buffer.from('test content');
    expect(hashBuffer(buf)).toBe(hashBuffer(buf));
    expect(hashBuffer(buf)).toHaveLength(64); // hex SHA-256
  });

  it('generates 6-digit access codes', () => {
    const code = generateAccessCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('verifies access codes correctly', () => {
    process.env.ACCESS_CODE_PEPPER = 'test-pepper';
    const code = generateAccessCode();
    const hash = hashAccessCode(code);
    expect(verifyAccessCode(code, hash)).toBe(true);
    expect(verifyAccessCode('000000', hash)).toBe(false);
  });

  it('produces different ciphertext for same data (random IV)', () => {
    const buf = Buffer.from('same content');
    const key = 'consistent-key-32-chars-or-longer!!';
    const id = 'file-123';
    const { encryptedBuffer: e1 } = encryptBuffer(buf, key, id);
    const { encryptedBuffer: e2 } = encryptBuffer(buf, key, id);
    expect(e1.equals(e2)).toBe(false); // different IVs each time
  });
});

// ── User Model ────────────────────────────────────────────────
describe('User model', () => {
  it('applies 30 GB default storage on creation', async () => {
    const user = new User({
      uid: 'test-uid', email: 'test@example.com',
    });
    expect(user.cloudStorage.totalBytes).toBe(30 * 1024 * 1024 * 1024);
  });

  it('applies 10 GB default download data', async () => {
    const user = new User({ uid: 'test-uid2', email: 'test2@example.com' });
    expect(user.downloadData.totalBytes).toBe(10 * 1024 * 1024 * 1024);
  });

  it('canWatchAd returns true for new user', () => {
    const user = new User({ uid: 'test-uid3', email: 'test3@example.com' });
    expect(user.canWatchAd()).toBe(true);
  });

  it('recordAdReward increases storage correctly', () => {
    const user = new User({ uid: 'test-uid4', email: 'test4@example.com' });
    const before = user.cloudStorage.totalBytes;
    const reward = 200 * 1024 * 1024; // 200 MB
    user.recordAdReward(reward, 'storage');
    expect(user.cloudStorage.totalBytes).toBe(before + reward);
  });

  it('does not exceed 100 GB storage cap', () => {
    const user = new User({ uid: 'test-uid5', email: 'test5@example.com' });
    user.cloudStorage.totalBytes = 99 * 1024 * 1024 * 1024;
    user.recordAdReward(5 * 1024 * 1024 * 1024, 'storage'); // try to add 5 GB
    expect(user.cloudStorage.totalBytes).toBe(100 * 1024 * 1024 * 1024);
  });

  it('hashes password and verifies it', async () => {
    const user = new User({ uid: 'test-uid6', email: 'test6@example.com' });
    await user.setPassword('mypassword123');
    expect(await user.comparePassword('mypassword123')).toBe(true);
    expect(await user.comparePassword('wrongpassword')).toBe(false);
  });
});
