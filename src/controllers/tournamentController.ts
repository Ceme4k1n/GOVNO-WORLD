import { Request, Response } from 'express'
import db from '../database/db'
import { io } from '../app'

const dotenv = require('dotenv')
dotenv.config()

export const generate_turn = async () => {
  // Получаем все города из таблицы, сортируя по shit_count в убывающем порядке
  const cities = await db.any('SELECT city_name FROM govno_db.govno_cities ORDER BY shit_count DESC LIMIT 10')

  // Массив для хранения турнирных пар
  const tournaments: { player1: string; player2: string }[] = []

  // Перебираем города по очереди и формируем пары
  for (let i = 0; i < cities.length - 1; i += 2) {
    const player1 = cities[i].city_name
    const player2 = cities[i + 1].city_name

    tournaments.push({ player1, player2 })
  }

  // Если пар больше 0, добавляем их в таблицу турниров
  if (tournaments.length > 0) {
    const tournamentInsertQueries = tournaments.map((tournament) => {
      return db.none('INSERT INTO govno_db.tournaments(player1, player2) VALUES($1, $2)', [tournament.player1, tournament.player2])
    })

    // Выполняем все запросы на добавление турнирных пар
    await Promise.all(tournamentInsertQueries)
    console.log('Турниры успешно добавлены')
  } else {
    console.log('Недостаточно городов для создания турниров')
  }
}

export const get_all_turns = async (req: Request, res: Response) => {
  try {
    const turns = await db.any(`SELECT * FROM govno_db.tournaments`)
    console.log(turns)

    res.status(200).json(turns)
  } catch (error) {
    console.error(error)
    res.status(500).send('Server error')
  }
}

export const user_do_bet = async (req: Request, res: Response) => {
  const { user_id, tournament_id, bet_bool, amount } = req.body
  if (!user_id && !tournament_id && !amount && bet_bool == null) {
    res.sendStatus(401)
    console.log(`Ошибка`)
    return
  }
  console.log(req.body)

  try {
    placeBet(user_id, tournament_id, bet_bool, amount)
    res.status(200).send('Работает')
  } catch (error) {
    console.error('❌ Ошибка в ', error)
  }
}

async function placeBet(user_id: number, tournament_id: number, bet_bool: boolean, amount: number) {
  try {
    await db.tx(async (t) => {
      const tournament = await t.oneOrNone(
        `SELECT total_bets_p1, total_bets_p2, price_p1, price_p2, price_p1_spread, price_p2_spread 
         FROM govno_db.tournaments 
         WHERE id = $1 AND status = 'active'`,
        [tournament_id]
      )

      console.log('Турнирные данные:', tournament)
      if (!tournament) throw new Error('❌ Турнир не найден или уже завершен')

      let totalPull, priceYes, priceNo, stakeYes, stakeNo, voisesAmount, user_profit, platform_profit

      if (bet_bool) {
        stakeYes = tournament.total_bets_p1 + amount
        stakeNo = tournament.total_bets_p2
      } else {
        stakeYes = tournament.total_bets_p1
        stakeNo = tournament.total_bets_p2 + amount
      }

      totalPull = stakeYes + stakeNo
      priceYes = stakeYes / totalPull
      priceNo = stakeNo / totalPull

      if (stakeYes === stakeNo) {
        priceYes = 0.5
        priceNo = 0.5
      } else {
        priceYes = stakeYes / totalPull
        priceNo = stakeNo / totalPull
      }

      const fairPrice = bet_bool ? tournament.price_p1 : tournament.price_p2

      voisesAmount = amount / (bet_bool ? tournament.price_p1_spread : tournament.price_p2_spread)
      user_profit = voisesAmount - amount

      const fairVoices = amount / fairPrice
      platform_profit = fairVoices - voisesAmount

      console.log(`Суммарный пул: ${totalPull}`)
      console.log(`Цена "Да" без спреда: ${priceYes.toFixed(2)}`)
      console.log(`Цена "Нет" без спреда: ${priceNo.toFixed(2)}`)
      console.log(`Наш профит: ${platform_profit.toFixed(2)}`)

      console.log(`После лимита: Цена "Да": ${priceYes.toFixed(2)}, Цена "Нет": ${priceNo.toFixed(2)}`)

      const percentageDifference = Math.abs(priceYes * 100 - priceNo * 100)
      let spread = percentageDifference / 2 / 10

      if (spread > 3) {
        spread = 3
      } else if (spread < 1) {
        spread = 1
      }

      const spreadForLessProb = (2 / 3) * spread
      const spreadForMoreProb = (1 / 3) * spread

      let priceYesWithSpread = priceYes + (stakeYes > stakeNo ? spreadForMoreProb : spreadForLessProb) / 100
      let priceNoWithSpread = priceNo + (stakeYes > stakeNo ? spreadForLessProb : spreadForMoreProb) / 100

      // Ограничение цен после спреда
      if (priceYesWithSpread >= 0.99) {
        priceYesWithSpread = 0.99
        priceNoWithSpread = 0.02
      } else if (priceNoWithSpread >= 0.99) {
        priceNoWithSpread = 0.99
        priceYesWithSpread = 0.02
      }

      console.log(`Цена "Да" со спредом: ${priceYesWithSpread.toFixed(2)}`)
      console.log(`Цена "Нет" со спредом: ${priceNoWithSpread.toFixed(2)}`)
      console.log(`Кол-во купленных голосов: ${voisesAmount}`)

      await t.none(
        `UPDATE govno_db.tournaments 
         SET total_bets_p1 = $1, total_bets_p2 = $2, price_p1 = $3, price_p2 = $4, 
             price_p1_spread = $5, price_p2_spread = $6, our_profite = our_profite + $7
         WHERE id = $8 AND status = 'active'`,
        [stakeYes, stakeNo, parseFloat(priceYes.toFixed(2)), parseFloat(priceNo.toFixed(2)), parseFloat(priceYesWithSpread.toFixed(2)), parseFloat(priceNoWithSpread.toFixed(2)), parseFloat(platform_profit.toFixed(2)), tournament_id]
      )

      await t.none(
        `INSERT INTO govno_db.bets(user_id, tournament_id, player_bool, amount, price_without_spread, price_with_spread, potential_win, user_profit)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8)`,
        [user_id, tournament_id, bet_bool, amount, bet_bool ? tournament.price_p1 : tournament.price_p2, bet_bool ? tournament.price_p1_spread : tournament.price_p2_spread, voisesAmount, user_profit]
      )

      io.emit('bet_update', {
        tournament_id,
        total_bets_p1: stakeYes,
        total_bets_p2: stakeNo,
        price_p1_spread: parseFloat(priceYesWithSpread.toFixed(2)),
        price_p2_spread: parseFloat(priceNoWithSpread.toFixed(2)),
      })

      console.log('✅ Ставка успешно обновлена')
    })
  } catch (error) {
    console.error('❌ Ошибка в `placeBet`:', error)
  }
}
