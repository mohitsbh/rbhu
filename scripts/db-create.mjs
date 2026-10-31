// Creates the rbhu_platform database (idempotent). The minimal portable
// PostgreSQL binary package ships no psql.exe, so we use node + pg against
// the maintenance database "postgres".
import pg from "pg";

const ADMIN_URL =
  process.env.DB_ADMIN_URL ??
  "postgresql://rbhu:RbhuDemo%40123@localhost:5433/postgres";
const TARGET = "rbhu_platform";

const client = new pg.Client({ connectionString: ADMIN_URL });
try {
  await client.connect();
  const { rows } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [TARGET]);
  if (rows.length === 0) {
    // DATABASE (and USERNAME) cannot be parameterised – fixed literal, safe input
    await client.query(`CREATE DATABASE ${TARGET} ENCODING 'UTF8'`);
    console.log(`[db] database '${TARGET}' created`);
  } else {
    console.log(`[db] database '${TARGET}' already exists`);
  }
} finally {
  await client.end();
}
