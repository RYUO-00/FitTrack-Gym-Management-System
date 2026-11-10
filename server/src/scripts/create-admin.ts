import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, query } from '../database/pool';

async function main() {
  const email = process.env.FITTRACK_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.FITTRACK_ADMIN_PASSWORD;
  const displayName = process.env.FITTRACK_ADMIN_NAME?.trim() || 'FitTrack Admin';
  if (!email || !password) throw new Error('Set FITTRACK_ADMIN_EMAIL and FITTRACK_ADMIN_PASSWORD before running npm run admin:create.');
  if (password.length < 12) throw new Error('FITTRACK_ADMIN_PASSWORD must be at least 12 characters.');
  const hash = await bcrypt.hash(password, 12);
  await query(`INSERT INTO admins(email,password_hash,display_name) VALUES($1,$2,$3)
    ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,display_name=EXCLUDED.display_name`, [email,hash,displayName]);
  console.log(`Administrator account ready for ${email}. The password is stored as a bcrypt hash.`);
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
  .finally(() => { void pool.end(); });
