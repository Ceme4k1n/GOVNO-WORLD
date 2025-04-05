import { Request, Response } from 'express'
import db from '../database/db'
import { io } from '../app'

const dotenv = require('dotenv')
dotenv.config()

export const generate_turn = async () => {
  try {
    // Получаем топ 20 городов по количеству покаков (или по нужной вам метрике)
    const cities = await db.any(`
        SELECT city_name
        FROM govno_db.govno_cities 
        ORDER BY shit_count DESC 
        LIMIT 20
      `)

    if (cities.length < 2) {
      console.log('Недостаточно городов для турниров')
      return
    }

    if (cities.length % 2 !== 0) {
      cities.pop()
    }

    let tournaments = []
    let numTournaments = cities.length / 2

    for (let i = 0; i < cities.length; i += 2) {
      const city1 = cities[i]
      const city2 = cities[i + 1]

      tournaments.push({
        city1: city1.city_name,
        city2: city2.city_name,
        total_bets1: 0, // Изначально нет ставок
        total_bets2: 0, // Изначально нет ставок
        price1: 1.0, // Изначальная цена голоса на 1-й город
        price2: 1.0, // Изначальная цена голоса на 2-й город
        spread: 0.02, // Начальный спред (2%)
        status: 'active', // Статус турнира
      })
    }

    const insertQuery = `
        INSERT INTO govno_db.tournaments 
        (city1, city2, total_bets1, total_bets2, price1, price2, spread, status) 
        VALUES ${tournaments.map((t) => `('${t.city1}', '${t.city2}', ${t.total_bets1}, ${t.total_bets2}, ${t.price1}, ${t.price2}, ${t.spread}, '${t.status}')`).join(', ')}
      `

    await db.none(insertQuery)

    console.log(`✅ Успешно создано ${numTournaments} турниров!`)
  } catch (error) {
    console.error('❌ Ошибка при генерации турниров:', error)
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

      let totalPull, priceYes, priceNo, stakeYes, stakeNo, voisesAmount

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

      voisesAmount = amount / (bet_bool ? tournament.price_p1_spread : tournament.price_p2_spread)

      console.log(`Суммарный пул: ${totalPull}`)
      console.log(`Цена "Да" без спреда: ${priceYes.toFixed(2)}`)
      console.log(`Цена "Нет" без спреда: ${priceNo.toFixed(2)}`)

      // Ограничение цен
      if (priceYes > 0.9) {
        priceYes = 0.9
        priceNo = 0.1
      } else if (priceNo > 0.9) {
        priceNo = 0.9
        priceYes = 0.1
      }

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
      if (priceYesWithSpread >= 1) {
        priceYesWithSpread = 0.99
        priceNoWithSpread = 0.02
      } else if (priceNoWithSpread >= 1) {
        priceNoWithSpread = 0.99
        priceYesWithSpread = 0.02
      }

      console.log(`Цена "Да" со спредом: ${priceYesWithSpread.toFixed(2)}`)
      console.log(`Цена "Нет" со спредом: ${priceNoWithSpread.toFixed(2)}`)
      console.log(`Кол-во купленных голосов: ${voisesAmount}`)

      await t.none(
        `UPDATE govno_db.tournaments 
         SET total_bets_p1 = $1, total_bets_p2 = $2, price_p1 = $3, price_p2 = $4, price_p1_spread = $5, price_p2_spread = $6
         WHERE id = $7 AND status = 'active'`,
        [stakeYes, stakeNo, parseFloat(priceYes.toFixed(2)), parseFloat(priceNo.toFixed(2)), parseFloat(priceYesWithSpread.toFixed(2)), parseFloat(priceNoWithSpread.toFixed(2)), tournament_id]
      )

      await t.none(
        `INSERT INTO govno_db.bets(user_id, tournament_id, player_bool, amount, price_without_spread, price_with_spread, potential_win, voice_amount)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8)`,
        [user_id, tournament_id, bet_bool, amount, bet_bool ? tournament.price_p1 : tournament.price_p2, bet_bool ? tournament.price_p1_spread : tournament.price_p2_spread, voisesAmount, voisesAmount]
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
