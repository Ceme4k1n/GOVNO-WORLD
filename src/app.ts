import express from 'express'
import { Server as SocketIOServer } from 'socket.io'

// Импортируем все остальные модули
import './cronJobs'
import db from './database/db'

import fs from 'fs'
import https from 'https'
import authRouter from './routes/auth'
import quizRouter from './routes/quiz'
import referralRouter from './routes/referral'
import newsRouter from './routes/news'
import profileRouter from './routes/profile'
import mapRouter from './routes/map'
import tournament from './routes/tournament'
import { generate_turn } from './controllers/tournamentController'

import path from 'path'

const app = express()
const PORT = process.env.PORT || 4000

app.use(express.json())

app.use(express.static(path.join(__dirname, '../html')))
app.use('/js', express.static(path.join(__dirname, '../js')))
app.use('/scss', express.static(path.join(__dirname, '../scss')))
app.use('/css', express.static(path.join(__dirname, '../css')))
app.use('/img', express.static(path.join(__dirname, '../img')))

app.use('/auth', authRouter)
app.use('/quiz', quizRouter)
app.use('/referral', referralRouter)
app.use('/news', newsRouter)
app.use('/profile', profileRouter)
app.use('/map', mapRouter)
app.use('/turs', tournament)

// Комментируем часть для HTTPS
/*
const SSL_CERT_PATH = '/web/serf/certificate.crt'
const SSL_KEY_PATH = '/web/serf/certificate.key'
const SSL_CA_PATH = '/web/serf/certificate_ca.crt'

const privateKey = fs.readFileSync(SSL_KEY_PATH, 'utf8')
const certificate = fs.readFileSync(SSL_CERT_PATH, 'utf8')
const ca = fs.readFileSync(SSL_CA_PATH, 'utf8')

const credentials = { key: privateKey, cert: certificate, ca: ca }

const httpsServer = https.createServer(credentials, app)
*/

// Используем HTTP сервер
const httpServer = app.listen(PORT, () => {
  console.log(`⚡ Server is running at http://localhost:${PORT}`)
})

// Инициализация Socket.IO с HTTP сервером
const io = new SocketIOServer(httpServer, {
  //Потом поменять на httpsServer
  cors: {
    origin: '*', // Разрешаем все домены, можно ограничить по необходимости
  },
})

// Обработчик подключения клиента через WebSocket
io.on('connection', (socket) => {
  console.log('✅ Новый WebSocket клиент подключился')

  socket.on('disconnect', () => {
    console.log('❌ Клиент отключился')
  })
})

// Экспортируем io для использования в других местах
export { io }

async function end_cities_and_counries() {
  try {
    await db.tx(async (t) => {
      // Получаем турниры, завершенные более 1 часа назад
      const ends_cities_id = await t.any(`
        SELECT id, total_bets_p1, total_bets_p2, winning_side
        FROM govno_db.tournaments
        WHERE created_at <= NOW() - INTERVAL '1 hour'
      `)

      console.log(ends_cities_id)

      if (ends_cities_id.length === 0) {
        console.log(`Нет закончившихся турниров`)
        return
      }

      // Обрабатываем каждый турнир
      for (const tournament of ends_cities_id) {
        const winning_side = tournament.winning_side // Получаем победившую сторону из поля winning_side
        const losing_side_total = winning_side ? tournament.total_bets_p2 : tournament.total_bets_p1 // Пул проигравшей стороны

        // Получаем все ставки для этого турнира
        const bets = await t.any(
          `
          SELECT user_id, amount, player_bool, user_profit
          FROM govno_db.bets
          WHERE tournament_id = $1
        `,
          [tournament.id]
        )

        // Фильтруем ставки на победившую сторону
        const winners = bets.filter((bet) => bet.player_bool === winning_side)

        // Проверка на 0 ставок на победившую сторону
        if (winners.length === 0) {
          console.log(`Нет ставок на победившую сторону для турнира ${tournament.id}`)
          continue // Пропускаем турнир, если нет ставок на победившую сторону
        }

        // Вычисляем количество победителей (ставки на победившую сторону)
        const winnerCount = winners.length
        const max_payment = losing_side_total / winnerCount // Максимальная выплата на каждого победителя
        console.log(`Tournament ID: ${tournament.id}, Max Payment: ${max_payment}`)

        // Пропорционально рассчитываем выплаты
        for (const bet of winners) {
          const user_profit = parseFloat(bet.user_profit) // Потенциальный выигрыш

          // Проверяем, если расчет не дает NaN
          if (isNaN(user_profit)) {
            console.log(`❌ Некорректный расчет выигрыша для User ID: ${bet.user_id} в турнире ${tournament.id}`)
            continue
          }

          // Определяем, какую сумму игрок получит
          const payout = Math.min(user_profit, max_payment)

          console.log(`User ID: ${bet.user_id} должен получить: ${payout}`)

          // Обновляем баланс пользователя в БД
          await t.none(
            `
            UPDATE govno_db.users
            SET balance = balance + $1
            WHERE tg_user_id = $2
          `,
            [payout, bet.user_id]
          )

          console.log(`Баланс пользователя ${bet.user_id} обновлён на ${payout}`)
        }

        console.log(`Распределение ${tournament.id} завершёно`)
      }
    })
  } catch (error) {
    console.error('❌ Ошибка в `end_bets`:', error)
  }
}

end_cities_and_counries()
