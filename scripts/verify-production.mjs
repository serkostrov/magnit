import pg from "pg";

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const pool = new Pool({ connectionString: databaseUrl, max: 1 });

try {
  const [migration, column, categories, products, invalidColors] =
    await Promise.all([
      pool.query(
        "SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '007_category_home_fields') AS present",
      ),
      pool.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'categories'
            AND column_name = 'home_color'
        ) AS present
      `),
      pool.query("SELECT count(*)::int AS count FROM categories"),
      pool.query("SELECT count(*)::int AS count FROM products"),
      pool.query(`
        SELECT count(*)::int AS count
        FROM categories
        WHERE home_color NOT IN ('blue', 'mint', 'sand', 'lilac', 'rose', 'cyan')
      `),
    ]);

  const result = {
    migration007: migration.rows[0].present,
    homeColorColumn: column.rows[0].present,
    categories: categories.rows[0].count,
    products: products.rows[0].count,
    invalidHomeColors: invalidColors.rows[0].count,
  };

  if (
    !result.migration007 ||
    !result.homeColorColumn ||
    result.categories < 1 ||
    result.products < 1 ||
    result.invalidHomeColors !== 0
  ) {
    throw new Error(`Production verification failed: ${JSON.stringify(result)}`);
  }

  console.log(JSON.stringify({ ok: true, ...result }));
} finally {
  await pool.end();
}
