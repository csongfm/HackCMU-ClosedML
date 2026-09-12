import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionDeadline, DatabaseConnectionError } from '../lib/connection-deadline.ts';

test('a stalled connection returns a bounded error', async () => {
  await assert.rejects(connectionDeadline(new Promise(() => {}), 15), DatabaseConnectionError);
});
test('successful connections and original connection errors are preserved', async () => {
  assert.equal(await connectionDeadline(Promise.resolve('connected'), 50), 'connected');
  const error = new Error('rejected');
  await assert.rejects(connectionDeadline(Promise.reject(error), 50), (actual) => actual === error);
});
test('a connection rejecting after its deadline does not leak an unhandled rejection', async () => {
  const connection = new Promise((_, reject) => setTimeout(() => reject(new Error('late failure')), 30));
  await assert.rejects(connectionDeadline(connection, 5), DatabaseConnectionError);
  await new Promise(resolve => setTimeout(resolve, 40));
});
