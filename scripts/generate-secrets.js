const crypto = require('node:crypto');
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
const password = (length) => Array.from(crypto.randomBytes(length), b => alphabet[b % alphabet.length]).join('');
console.log('三个可选管理员密码（任选其一放进 .env）：');
for (let i = 0; i < 3; i++) console.log(`${i + 1}. ${password(24)}`);
console.log(`\nSESSION_SECRET=${crypto.randomBytes(48).toString('base64url')}`);
