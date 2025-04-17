import { Request, Response } from 'express'
import db from '../database/db'
import { io } from '../app'

const dotenv = require('dotenv')
dotenv.config()

export const generate_turn = async () => {
  try {
    await db.tx(async (t) => {
      const cities = await t.any(`
        SELECT city_name 
        FROM govno_db.govno_cities 
        ORDER BY shit_count DESC 
        LIMIT 10
      `)

      const cityTournaments: { player1: string; player2: string }[] = []

      for (let i = 0; i < cities.length - 1; i += 2) {
        cityTournaments.push({
          player1: cities[i].city_name,
          player2: cities[i + 1].city_name,
        })
      }

      if (cityTournaments.length > 0) {
        const cityInsertQueries = cityTournaments.map((tournament) => {
          return t.none('INSERT INTO govno_db.tournaments(player1, player2, version_id) VALUES($1, $2, 0)', [tournament.player1, tournament.player2])
        })
        await Promise.all(cityInsertQueries)
        console.log('Турниры по городам успешно добавлены')
      } else {
        console.log('Недостаточно городов для создания турниров')
      }

      const countries = await t.any(`
        SELECT country_name 
        FROM govno_db.govno_countries 
        ORDER BY shit_count DESC 
        LIMIT 10
      `)

      const countryTournaments: { player1: string; player2: string }[] = []

      for (let i = 0; i < countries.length - 1; i += 2) {
        countryTournaments.push({
          player1: countries[i].country_name,
          player2: countries[i + 1].country_name,
        })
      }

      if (countryTournaments.length > 0) {
        const countryInsertQueries = countryTournaments.map((tournament) => {
          return t.none('INSERT INTO govno_db.tournaments(player1, player2, version_id) VALUES($1, $2, 1)', [tournament.player1, tournament.player2])
        })
        await Promise.all(countryInsertQueries)
        console.log('Турниры по странам успешно добавлены')
      } else {
        console.log('Недостаточно стран для создания турниров')
      }
    })
  } catch (error) {
    console.error('Ошибка при добавлении турниров:', error)
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

  if (!user_id || !tournament_id || amount == null || bet_bool == null) {
    console.log(`Ошибка: не все поля`)
    res.status(400).send('❌ Неверные данные запроса')
  }

  if (amount <= 0) {
    console.log(`Ошибка: ставка меньше 0`)
    res.status(400).send('❌ Ставка должна быть больше 0')
  }

  console.log(req.body)

  try {
    await placeBet(user_id, tournament_id, bet_bool, amount)
    res.status(200).send('✅ Ставка принята')
  } catch (error: any) {
    console.error('❌ Ошибка при ставке:', error)
    res.status(500).send(error.message || '❌ Ошибка на сервере')
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

      const priceYes = tournament.price_p1
      const priceNo = tournament.price_p2
      const priceYesSpread = tournament.price_p1_spread
      const priceNoSpread = tournament.price_p2_spread

      const fairSum = priceYes + priceNo
      const spreadSum = priceYesSpread + priceNoSpread
      const spreadPercent = spreadSum - fairSum

      // 💰 Расчёт чистой ставки (в пул) и спреда (доход платформы)
      const effectiveStake = amount * (1 - spreadPercent)
      const platform_profit = amount * spreadPercent

      // 📊 Обновляем пулы с учётом чистой ставки
      let stakeYes = tournament.total_bets_p1
      let stakeNo = tournament.total_bets_p2

      if (bet_bool) {
        stakeYes += effectiveStake
      } else {
        stakeNo += effectiveStake
      }

      const totalPull = stakeYes + stakeNo

      //Новые "честные" цены (без спреда)
      let priceYesNew = stakeYes / totalPull
      let priceNoNew = stakeNo / totalPull

      //Расчёт нового спреда на основе разбалансировки
      const percentageDifference = Math.abs(priceYesNew * 100 - priceNoNew * 100)
      let spread = percentageDifference / 2 / 10

      if (spread > 3) {
        spread = 3
      } else if (spread < 1) {
        spread = 1
      }

      const spreadForLessProb = (2 / 3) * spread
      const spreadForMoreProb = (1 / 3) * spread

      let priceYesWithSpread = priceYesNew + (stakeYes > stakeNo ? spreadForMoreProb : spreadForLessProb) / 100
      let priceNoWithSpread = priceNoNew + (stakeYes > stakeNo ? spreadForLessProb : spreadForMoreProb) / 100

      //Ограничения по границам вероятностей
      if (priceYesWithSpread >= 0.99) {
        priceYesWithSpread = 0.98
        priceNoWithSpread = 0.03
        priceYesNew = 0.97
        priceNoNew = 0.01
      } else if (priceNoWithSpread >= 0.99) {
        priceNoWithSpread = 0.98
        priceYesWithSpread = 0.03
        priceNoNew = 0.97
        priceYesNew = 0.01
      }

      if (stakeYes === stakeNo) {
        priceYesNew = priceNoNew = 0.5
        priceYesWithSpread = priceNoWithSpread = 0.5
      }

      const fairPrice = bet_bool ? priceYesNew : priceNoNew
      const voisesAmount = amount / (bet_bool ? tournament.price_p1_spread : tournament.price_p2_spread)

      // 🔄 Обновление турнира
      await t.none(
        `UPDATE govno_db.tournaments 
         SET total_bets_p1 = $1, total_bets_p2 = $2, price_p1 = $3, price_p2 = $4, 
             price_p1_spread = $5, price_p2_spread = $6, our_profite = our_profite + $7
         WHERE id = $8 AND status = 'active'`,
        [stakeYes, stakeNo, parseFloat(priceYesNew.toFixed(2)), parseFloat(priceNoNew.toFixed(2)), parseFloat(priceYesWithSpread.toFixed(2)), parseFloat(priceNoWithSpread.toFixed(2)), parseFloat(platform_profit.toFixed(2)), tournament_id]
      )

      await t.none(
        `INSERT INTO govno_db.bets(user_id, tournament_id, player_bool, amount, price_without_spread, price_with_spread, potential_win, user_profit)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8)`,
        [user_id, tournament_id, bet_bool, amount, fairPrice, bet_bool ? tournament.price_p1_spread : tournament.price_p2_spread, voisesAmount, voisesAmount - amount]
      )

      io.emit('bet_update', {
        tournament_id,
        total_bets_p1: stakeYes,
        total_bets_p2: stakeNo,
        price_p1_spread: parseFloat(priceYesWithSpread.toFixed(2)),
        price_p2_spread: parseFloat(priceNoWithSpread.toFixed(2)),
      })

      console.log('✅ Ставка успешно размещена')
    })
  } catch (error) {
    console.error('❌ Ошибка в `placeBet`:', error)
  }
}

export const distributed_cities_and_counries = async () => {
  try {
    await db.tx(async (t) => {
      // Получаем турниры, завершенные более 1 часа назад
      const ends_id = await t.any(`
        SELECT id, total_bets_p1, total_bets_p2, winning_side, distributed_status
        FROM govno_db.tournaments
        WHERE created_at <= NOW() - INTERVAL '7 days' AND distributed_status = 'no_distributed' AND status = 'finished'
      `)

      console.log(ends_id)

      if (ends_id.length === 0) {
        console.log(`Нет закончившихся турниров`)
        return
      }

      for (const tournament of ends_id) {
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
              [bet.user_id, tournament.id, bet.player_bool, bet.amount, bet.user_profit, 0, false, bet.created_at]
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

export const end_cites_and_countries_tours = async () => {
  try {
    const result = await db.result(
      `UPDATE govno_db.tournaments 
       SET status = 'finished' 
       WHERE status = 'active' 
       AND created_at <= NOW() - INTERVAL '7 days'`
    )

    if (result.rowCount > 0) {
      console.log(`🕒 Авто-завершено турниров: ${result.rowCount}, запускаем распределение`)
      await distributed_cities_and_counries()
      console.log(`Рассчитал выплаты и сделал их`)
      generate_turn()
      console.log(`Создал новые турниры`)
    } else {
      console.log('🟢 Нет турниров к завершению — пропуск')
    }
  } catch (error) {
    console.error('❌ Ошибка в авто-деактивации турниров:', error)
  }
}
