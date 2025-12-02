const assert = require('chai').assert;
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const fs = require('fs');

let testEnv;

describe('Firestore rules', () => {
  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'demo-project',
      firestore: { rules: fs.readFileSync('..\\..\\firestore.rules', 'utf8') }
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  it('should allow owner to get their order', async () => {
    const alice = testEnv.authenticatedContext('alice-uid');
    const db = alice.firestore();

    const orderRef = db.collection('orders').doc('order-1');
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await context.firestore().doc('orders/order-1').set({ userId: 'alice-uid', price: 100 });
    });

    await assertSucceeds(orderRef.get());
  });

  it('should deny list for non-admin', async () => {
    const bob = testEnv.authenticatedContext('bob-uid', { role: 'washer' });
    const db = bob.firestore();
    const ordersRef = db.collection('orders');
    await assertFails(ordersRef.get());
  });
});
