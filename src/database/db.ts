import pgPromise from 'pg-promise'
import dotenv from 'dotenv'

dotenv.config()

const pgp = pgPromise({
  // Логирование подключения
  connect() {
    console.log('🔗 Соединение с базой данных открыто')
  },
  // Логирование отключения
  disconnect() {
    console.log('🔌 Соединение с базой данных закрыто')
  },
})

const db = pgp({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  max: 100,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

export default db
