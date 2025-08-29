const { Pool } = require('pg');
const DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/soberlivings';

async function checkCount() {
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    const result = await pool.query('SELECT COUNT(*) as total FROM facilities');
    console.log(`\n📊 Total facilities in database: ${result.rows[0].total}`);
    
    // Get breakdown by state
    const stateBreakdown = await pool.query(`
      SELECT state, COUNT(*) as count 
      FROM facilities 
      GROUP BY state 
      ORDER BY count DESC 
      LIMIT 10
    `);
    
    console.log('\n📍 Top 10 states by facility count:');
    stateBreakdown.rows.forEach(row => {
      console.log(`   ${row.state}: ${row.count} facilities`);
    });
  } finally {
    await pool.end();
  }
}

checkCount().catch(console.error);