const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = 'postgresql://postgres:3QSPuJQhKjULCW0q@db.anipmjehvmovjfnqnvkl.supabase.co:5432/postgres';

async function execute() {
  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to Supabase DB');

    const sql = fs.readFileSync(path.join(__dirname, 'supabase', 'setup.sql'), 'utf8');
    await client.query(sql);
    console.log('SQL executed successfully!');

  } catch (err) {
    console.error('Error executing SQL:', err);
  } finally {
    await client.end();
  }
}

execute();
