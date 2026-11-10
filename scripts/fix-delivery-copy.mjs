import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

export const fields = ['short_description', 'description_html', 'seo_description'];
export function fixDeliveryCopy(value) {
  return value.replace(/бесплатной (курьерской доставкой (?:по )?Москве(?: Москве)?)(?: \(при определенных условиях от (?:15|30)\s?000 рублей\))?/gu, '$1');
}

// First create and inspect a plan. Before applying on production, create and
// verify a full database backup using scripts/backup-production.mjs.
async function main() {
  const [mode, planPath] = process.argv.slice(2);
  if (!['plan', 'apply'].includes(mode) || !planPath) throw new Error('Usage: node scripts/fix-delivery-copy.mjs plan|apply /absolute/plan.json');
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const client = await pool.connect();
  try {
    if (mode === 'plan') {
      const { rows } = await client.query(`SELECT id, slug, ${fields.join(',')} FROM products ORDER BY id`);
      const changes = rows.map(row => ({ id: row.id, slug: row.slug,
        before: Object.fromEntries(fields.map(f => [f, row[f]])),
        after: Object.fromEntries(fields.map(f => [f, fixDeliveryCopy(row[f])])),
      })).filter(row => fields.some(f => row.before[f] !== row.after[f]));
      const plan = { version: 1, createdAt: new Date().toISOString(), scanned: rows.length, changes };
      await writeFile(planPath, JSON.stringify(plan, null, 2), { flag: 'wx', mode: 0o600 });
      const verified = JSON.parse(await readFile(planPath, 'utf8'));
      if (JSON.stringify(verified) !== JSON.stringify(plan)) throw new Error('Plan readback mismatch');
      console.log(JSON.stringify({ scanned: rows.length, changedProducts: changes.length, changedFields: Object.fromEntries(fields.map(f => [f, changes.filter(r => r.before[f] !== r.after[f]).length])), planPath }));
    } else {
      const plan = JSON.parse(await readFile(planPath, 'utf8'));
      if (plan.version !== 1 || !Array.isArray(plan.changes)) throw new Error('Invalid plan');
      if (new Set(plan.changes.map(r => r.id)).size !== plan.changes.length) throw new Error('Duplicate IDs');
      await client.query('BEGIN');
      for (const row of plan.changes) {
        for (const f of fields) if (fixDeliveryCopy(row.before[f]) !== row.after[f]) throw new Error('Unapproved replacement');
        const result = await client.query(`UPDATE products SET short_description=$1, description_html=$2, seo_description=$3, updated_at=now() WHERE id=$4 AND slug=$5 AND short_description=$6 AND description_html=$7 AND seo_description=$8 RETURNING id`, [...fields.map(f => row.after[f]), row.id, row.slug, ...fields.map(f => row.before[f])]);
        if (result.rowCount !== 1) throw new Error(`Concurrent edit or missing product: ${row.id}`);
      }
      for (const row of plan.changes) {
        const { rows } = await client.query(`SELECT ${fields.join(',')} FROM products WHERE id=$1`, [row.id]);
        if (fields.some(f => rows[0][f] !== row.after[f])) throw new Error(`Readback mismatch: ${row.id}`);
      }
      await client.query('COMMIT');
      console.log(JSON.stringify({ committed: plan.changes.length }));
    }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally { client.release(); await pool.end(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
