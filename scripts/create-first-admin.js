#!/usr/bin/env node

/**
 * scripts/create-first-admin.js
 *
 * Usage (PowerShell):
 * $env:FIREBASE_SERVICE_ACCOUNT_KEY = Get-Content -Raw 'C:\secrets\service-account.json'
 * node scripts/create-first-admin.js --email admin@ejemplo.com --password secreto123 --firstName Rodrigo --lastName Perez --role admin
 *
 * This script initializes firebase-admin using the JSON stored in FIREBASE_SERVICE_ACCOUNT_KEY
 * and creates a new user, assigns a custom claim (role) and creates a Firestore profile.
 */

const admin = require('firebase-admin');
const { program } = require('commander');

program
  .requiredOption('--email <email>')
  .requiredOption('--password <password>')
  .requiredOption('--firstName <firstName>')
  .requiredOption('--lastName <lastName>')
  .option('--role <role>', 'role to assign (admin|washer)', 'admin');

program.parse(process.argv);
const opts = program.opts();

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!raw) {
    console.error('FIREBASE_SERVICE_ACCOUNT_KEY not set in environment.');
    process.exit(2);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY as JSON:', e.message);
    process.exit(2);
  }
}

async function main() {
  const serviceAccount = getServiceAccount();

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
  } catch (e) {
    // if already initialized, use the existing app
    if (!/already exists/.test(String(e))) {
      console.error('Error initializing admin SDK:', e);
      process.exit(3);
    }
  }

  const auth = admin.auth();
  const firestore = admin.firestore();

  try {
    const userRecord = await auth.createUser({
      email: opts.email,
      emailVerified: true,
      password: opts.password,
      displayName: `${opts.firstName} ${opts.lastName}`,
    });

    if (opts.role) {
      await auth.setCustomUserClaims(userRecord.uid, { role: opts.role });
    }

    await firestore.collection('users').doc(userRecord.uid).set({
      id: userRecord.uid,
      firstName: opts.firstName,
      lastName: opts.lastName,
      email: opts.email,
      role: opts.role || null,
      createdAt: new Date(),
    });

    console.log('Admin user created successfully. uid=', userRecord.uid);
    process.exit(0);
  } catch (error) {
    console.error('Error creating user:', error);
    process.exit(1);
  }
}

main();
