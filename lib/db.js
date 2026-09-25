import pg from "pg";
const {Pool}=pg;
let pool;
export function db(){if(!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured."); if(!pool) pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==="production"?{rejectUnauthorized:false}:false}); return pool;}