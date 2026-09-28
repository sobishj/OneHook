import { env } from 'cloudflare:test';
import jwt from 'jsonwebtoken';

const JWT_SECRET = 'test_only_jwt_secret_do_not_use_in_prod';

let counter = 0;
function uniqueSuffix() {
  counter += 1;
  return `${Date.now()}_${counter}`;
}

export async function createTestUser(usernamePrefix = 'user') {
  const suffix = uniqueSuffix();
  const id = crypto.randomUUID();
  const username = `${usernamePrefix}_${suffix}`;
  const email = `${username}@example.com`;

  await env.DB.prepare(
    `INSERT INTO users (id, username, email, email_verified) VALUES (?, ?, ?, 1)`
  ).bind(id, username, email).run();

  const token = jwt.sign({ id, username, email }, JWT_SECRET, { expiresIn: '30d' });
  return { id, username, email, token };
}

export function authedRequest(path, { method = 'GET', token, body } = {}) {
  const init = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return new Request(`https://example.com${path}`, init);
}
