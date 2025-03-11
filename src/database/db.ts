import pgPromise from 'pg-promise'
import dotenv from 'dotenv'

dotenv.config()

const pgp = pgPromise()

const db = pgp({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
})

export default db
