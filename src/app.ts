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
        SELECT id, total_bets_p1, total_bets_p2, winning_side, distributed_status
        FROM govno_db.tournaments
        WHERE created_at <= NOW() - INTERVAL '1 hour' AND distributed_status = 'no_distributed'
      `)

      console.log(ends_cities_id)

      if (ends_cities_id.length === 0) {
        console.log(`Нет закончившихся турниров`)
        return
      }

      for (const tournament of ends_cities_id) {
        const winning_side = tournament.winning_side
        const losing_side_total = winning_side ? tournament.total_bets_p2 : tournament.total_bets_p1

        const bets = await t.any(
          `
          SELECT user_id, amount, player_bool, user_profit, created_at
          FROM govno_db.bets
          WHERE tournament_id = $1
        `,
          [tournament.id]
        )

        if (bets.length === 0) {
          console.log(`Нет ставок в турнире ${tournament.id}`)
          continue
        }

        const winners = bets.filter((bet) => bet.player_bool === winning_side)

        if (winners.length === 0) {
          console.log(`Нет ставок на победившую сторону для турнира ${tournament.id}`)
          // Даже если нет победителей, записываем всю историю проигравших
          for (const bet of bets) {
            await t.none(
              `
              INSERT INTO govno_db.bets_history (
                user_id, tournament_id, player_bool, amount, user_profit, payout, did_win, created_at, finished_at
              )
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
            `,
              [
                bet.user_id,
                tournament.id,
                bet.player_bool,
                bet.amount,
                bet.user_profit,
                0, // payout
                false,
                bet.created_at,
              ]
            )
          }
          continue
        }

        // Если пул проигравшей стороны 0 — возвращаем ставки
        if (losing_side_total <= 1) {
          console.log(`Пул проигравшей стороны равен 0 в турнире ${tournament.id} — возвращаем только ставки`)
          for (const bet of bets) {
            await t.none(
              `
              UPDATE govno_db.users
              SET balance = balance + $1
              WHERE tg_user_id = $2
            `,
              [parseFloat(bet.amount), bet.user_id]
            )

            await t.none(
              `
              INSERT INTO govno_db.bets_history (
                user_id, tournament_id, player_bool, amount, user_profit, payout, did_win, created_at, finished_at
              )
              VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
            `,
              [bet.user_id, tournament.id, bet.player_bool, bet.amount, bet.user_profit, parseFloat(bet.amount), bet.player_bool === winning_side, bet.created_at]
            )
          }
          continue
        }

        const winnerCount = winners.length
        const max_payment = losing_side_total / winnerCount
        console.log(`Tournament ID: ${tournament.id}, Max Payment: ${max_payment}`)

        for (const bet of bets) {
          const isWinner = bet.player_bool === winning_side
          const user_profit = parseFloat(bet.user_profit)
          const amount = parseFloat(bet.amount)

          if (isNaN(user_profit)) {
            console.log(`❌ Некорректный расчет выигрыша для User ID: ${bet.user_id} в турнире ${tournament.id}`)
            continue
          }

          const payout = isWinner ? Math.min(user_profit, max_payment) : 0

          if (payout > 0) {
            await t.none(
              `
              UPDATE govno_db.users
              SET balance = balance + $1
              WHERE tg_user_id = $2
            `,
              [payout + amount, bet.user_id]
            )
            console.log(`Баланс пользователя ${bet.user_id} обновлён на ${payout}`)
          } else if (isWinner === true && losing_side_total <= 1) {
            // в случае возврата по причине нулевого пула (защита от повторной обработки)
            await t.none(
              `
              UPDATE govno_db.users
              SET balance = balance + $1
              WHERE tg_user_id = $2
            `,
              [amount, bet.user_id]
            )
          }

          await t.none(
            `
            INSERT INTO govno_db.bets_history (
              user_id, tournament_id, player_bool, amount, user_profit, payout, did_win, created_at, finished_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
          `,
            [bet.user_id, tournament.id, bet.player_bool, amount, user_profit, payout, isWinner, bet.created_at]
          )
        }

        await t.none(
          `
          UPDATE govno_db.tournaments
          SET distributed_status = 'distributed'
          WHERE id = $1
        `,
          [tournament.id]
        )

        console.log(`Распределение ${tournament.id} завершено`)
      }
    })
  } catch (error) {
    console.error('❌ Ошибка в `end_bets`:', error)
  }
}

end_cities_and_counries()
