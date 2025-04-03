import express from 'express'

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
const PORT = process.env.PORT || '4000'

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

// const SSL_CERT_PATH = '/web/serf/certificate.crt'
// const SSL_KEY_PATH = '/web/serf/certificate.key'
// const SSL_CA_PATH = '/web/serf/certificate_ca.crt'

// const privateKey = fs.readFileSync(SSL_KEY_PATH, 'utf8')
// const certificate = fs.readFileSync(SSL_CERT_PATH, 'utf8')
// const ca = fs.readFileSync(SSL_CA_PATH, 'utf8')

// const credentials = { key: privateKey, cert: certificate, ca: ca }

// https.createServer(credentials, app).listen(PORT, () => {
//   console.log(`Server is running on https://orchidshop.shop`)
// })

app.listen(PORT, () => {
  console.log(`⚡ Server is running at http://localhost:${PORT}`)
})

async function placeBet(user_id: number, tournament_id: number, bet_bool: boolean, amount: number) {
  try {
    // Получаем данные о турниреы
    const tournament = await db.oneOrNone(
      `
      SELECT total_bets_p1, total_bets_p2, price_p1, price_p2, price_p1_spread, price_p2_spread 
      FROM govno_db.tournaments 
      WHERE id = $1 AND status = 'active'`,
      [tournament_id]
    )

    console.log('Турнирные данные:', tournament)

    if (!tournament) {
      console.log('❌ Турнир не найден или уже завершен')
      throw new Error('Турнир не найден или уже завершен')
    }
    let totalPull, priceYes, priceNo, stakeYes, stakeNo, voisesAmount

    if (bet_bool) {
      await db.none(`UPDATE govno_db.tournaments SET total_bets_p1 = $1 WHERE id = $2 AND status = 'active'`, [tournament.total_bets_p1 + amount, tournament_id])
      totalPull = tournament.total_bets_p1 + tournament.total_bets_p2 + amount
      priceYes = (tournament.total_bets_p1 + amount) / totalPull
      priceNo = tournament.total_bets_p2 / totalPull
      stakeYes = tournament.total_bets_p1 + amount
      stakeNo = tournament.total_bets_p2
      voisesAmount = amount / tournament.price_p1_spread
    } else {
      await db.none(`UPDATE govno_db.tournaments SET total_bets_p2 = $1 WHERE id = $2 AND status = 'active'`, [tournament.total_bets_p2 + amount, tournament_id])
      totalPull = tournament.total_bets_p1 + tournament.total_bets_p2 + amount
      priceYes = tournament.total_bets_p1 / totalPull
      priceNo = (tournament.total_bets_p2 + amount) / totalPull
      stakeNo = tournament.total_bets_p2 + amount
      stakeYes = tournament.total_bets_p1
      voisesAmount = amount / tournament.price_p2_spread
    }

    console.log(totalPull)
    console.log('Да без спреда:', priceYes.toFixed(2))
    console.log('Нет без спреда:', priceNo.toFixed(2))

    const percentageDifference = Math.abs(priceYes * 100 - priceNo * 100)

    let spread = percentageDifference / 2 / 10

    if (spread > 3) {
      spread = 3
    } else if (spread < 1) {
      spread = 1
    }

    console.log('Спред', spread)

    const spreadForLessProb = (2 / 3) * spread // Спред для менее вероятного исхода
    const spreadForMoreProb = (1 / 3) * spread // Спред для более вероятного исхода

    let priceYesWithSpread
    let priceNoWithSpread

    if (stakeYes > stakeNo) {
      priceYesWithSpread = priceYes + spreadForMoreProb / 100
      priceNoWithSpread = priceNo + spreadForLessProb / 100
    } else {
      priceYesWithSpread = priceYes + spreadForLessProb / 100
      priceNoWithSpread = priceNo + spreadForMoreProb / 100
    }

    console.log('Да со спредом:', priceYesWithSpread.toFixed(2))
    console.log('Нет со спредом:', priceNoWithSpread.toFixed(2))

    console.log(`Кол-во купленных голосов:`, voisesAmount)

    await db.none(`UPDATE govno_db.tournaments SET price_p1 = $1, price_p2 = $2, price_p1_spread = $3, price_p2_spread = $4 WHERE id = $5 AND status = 'active'`, [Math.trunc(priceYes * 100) / 100, Math.trunc(priceNo * 100) / 100, Math.trunc(priceYesWithSpread * 100) / 100, Math.trunc(priceNoWithSpread * 100) / 100, tournament_id])
    if (bet_bool) {
      await db.none(
        `INSERT INTO govno_db.bets(user_id, tournament_id, player_bool, amount, price_without_spread, price_with_spread, potential_win, voice_amount)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8)`,
        [user_id, tournament_id, bet_bool, amount, tournament.price_p1, tournament.price_p1_spread, voisesAmount, voisesAmount]
      )
    } else {
      await db.none(
        `INSERT INTO govno_db.bets(user_id, tournament_id, player_bool, amount, price_without_spread, price_with_spread, potential_win, voice_amount)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8)`,
        [user_id, tournament_id, bet_bool, amount, tournament.price_p2, tournament.price_p2_spread, voisesAmount, voisesAmount]
      )
    }

    console.log('✅ Ставка успешно обновлена')
  } catch (error) {
    console.error('❌ Ошибка в `placeBet`:', error)
  }
}

placeBet(1, 1, true, 100)
