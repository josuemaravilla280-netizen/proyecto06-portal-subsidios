import postgres from 'postgres';
import 'dotenv/config.js';
const sql = postgres('postgres://username:password@host:port/database', {
  host                 : process.env.PGHOST,            // Postgres ip address[s] or domain name[s]
  port                 : Number(process.env.PGPORT),          // Postgres server port[s]
  database             : process.env.PGDB,            // Name of database to connect to
  username             : process.env.PGUSER,            // Username of database user
  password             : process.env.PGPASSWORD,            // Password of database user
})

export default sql;