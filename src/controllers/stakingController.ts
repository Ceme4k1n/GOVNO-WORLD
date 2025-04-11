import { Request, Response } from 'express'
import db from '../database/db'

const dotenv = require('dotenv')
dotenv.config()

export const create_day_night_staking = async (req: Request, res: Response) => {
  const { user_id, amount, stake_type } = req.body

  if (!user_id || !amount || !stake_type) {
    res.sendStatus(401)
    return
  }

  if (amount <= 0) {
    res.sendStatus(402)
    return
  }
  try {
    const last_claim = new Date()
    const currentHour = last_claim.getHours()

    await db.tx(async (t) => {
      if (stake_type === 'day') {
        if (currentHour < 6 || currentHour >= 24) {
          res.status(403).json({ error: 'Дневной стейк можно создавать только с 06:00 до 23:59' })
          return
        }

        await t.none(`INSERT INTO govno_db.day_staking(user_id, amount, potencial_win, last_claim)  VALUES($1, $2, $3, $4)`, [user_id, amount, amount * 1.05, last_claim])

        res.status(200).json(`Создал дневной стейк`)
        return
      } else if (stake_type === 'night') {
        if (currentHour >= 6) {
          res.status(403).json({ error: 'Ночной стейк можно создавать только с 00:00 до 05:59' })
          return
        }

        await t.none(`INSERT INTO govno_db.night_staking(user_id, amount, potencial_win, last_claim)  VALUES($1, $2, $3, $4)`, [user_id, amount, amount * 1.15, last_claim])

        res.status(200).json(`Создал ночной стейк`)
        return
      } else if (stake_type === 'super') {
        await t.none(`INSERT INTO govno_db.super_staking(user_id, amount, potencial_win, last_claim)  VALUES($1, $2, $3, $4)`, [user_id, amount, amount * 1.3, last_claim])

        res.status(200).json(`Создал супер стейк`)
        return
      }
    })
  } catch (error) {
    console.error('Ошибка при добавлении стейкинга:', error)
  }
}

export const get_staking_active = async (req: Request, res: Response) => {
  const { user_id } = req.query

  if (!user_id) {
    res.sendStatus(401)
    return
  }

  try {
    await db.tx(async (t) => {
      const dayStakes = await t.any(
        `SELECT id, amount, potencial_win, days_completed, is_active, last_claim, gambler_level,
                'day' AS type
           FROM govno_db.day_staking 
           WHERE user_id = $1 AND is_active = TRUE AND burned = FALSE`,
        [user_id]
      )

      const nightStakes = await t.any(
        `SELECT id, amount, potencial_win, days_completed, is_active, last_claim, gambler_level,
                'night' AS type
           FROM govno_db.night_staking 
           WHERE user_id = $1 AND is_active = TRUE AND burned = FALSE`,
        [user_id]
      )

      const superStakes = await t.any(
        `SELECT id, amount, potencial_win, days_completed, is_active, last_claim, gambler_level,
                'super' AS type
           FROM govno_db.super_staking 
           WHERE user_id = $1 AND is_active = TRUE AND burned = FALSE`,
        [user_id]
      )

      const allStakes = [...dayStakes, ...superStakes, ...nightStakes]

      res.status(200).json(allStakes)
    })
  } catch (error) {
    console.error('Ошибка при получении стейкингов:', error)
    res.sendStatus(500)
  }
}

export const update_stakings = async (req: Request, res: Response) => {
  const { user_id, stake_id, stake_type } = req.query

  if (!user_id || !stake_id) {
    res.sendStatus(401)
    return
  }

  try {
    const claim_time = new Date()
    const currentHour = claim_time.getHours()

    await db.tx(async (t) => {
      if (stake_type === 'day') {
        if (currentHour < 6 || currentHour >= 24) {
          res.status(403).json({ error: 'Дневной стейк можно подтвердить только с 06:00 до 23:59' })
          return
        }

        const row = await t.oneOrNone(
          `
            SELECT last_claim, gambler_level
            FROM govno_db.day_staking
            WHERE user_id = $1 AND id = $2
            `,
          [user_id, stake_id]
        )

        if (!row) {
          res.status(404).json({ error: 'Стейкинг не найден' })
          return
        }

        const lastClaimTime = new Date(row.last_claim)
        const level = parseInt(row.gambler_level) || 0

        // Базовая точка отсчёта: сутки от прошлого клима
        const nextWindowStart = new Date(lastClaimTime)
        nextWindowStart.setDate(nextWindowStart.getDate() + 1)

        // Устанавливаем длительность окна по уровню
        let windowMinutes = 5
        if (level === 1) windowMinutes = 2.5
        else if (level >= 2) windowMinutes = 1.25

        const windowEnd = new Date(nextWindowStart.getTime() + windowMinutes * 60 * 1000)

        if (claim_time < nextWindowStart) {
          res.status(405).json({ error: 'Вы слишком рано' })
          return
        }
        if (claim_time > windowEnd) {
          res.status(406).json({ error: 'Вы опоздали' })
          burn_stake(user_id, stake_id, 'day')
          return
        }

        await t.none(
          `
            UPDATE govno_db.day_staking 
            SET days_completed = days_completed + 1, last_claim = $1
            WHERE user_id = $2 AND id = $3
            `,
          [claim_time, user_id, stake_id]
        )

        res.status(200).json({ last_claim: claim_time })
        return
      } else if (stake_type === 'night') {
        if (currentHour >= 6) {
          res.status(403).json({ error: 'Ночной стейк можно подтвердить только с 00:00 до 05:59' })
          return
        }
        const row = await t.oneOrNone(
          `
            SELECT last_claim, gambler_level
            FROM govno_db.night_staking
            WHERE user_id = $1 AND id = $2
            `,
          [user_id, stake_id]
        )

        if (!row) {
          res.status(404).json({ error: 'Стейкинг не найден' })
          return
        }

        const lastClaimTime = new Date(row.last_claim)
        const level = parseInt(row.gambler_level) || 0

        // Базовая точка отсчёта: сутки от прошлого клима
        const nextWindowStart = new Date(lastClaimTime)
        nextWindowStart.setDate(nextWindowStart.getDate() + 1)

        // Устанавливаем длительность окна по уровню
        let windowMinutes = 15
        if (level === 1) windowMinutes = 7.5
        else if (level >= 2) windowMinutes = 3.25
        else if (level >= 3) windowMinutes = 1.6

        const windowEnd = new Date(nextWindowStart.getTime() + windowMinutes * 60 * 1000)

        if (claim_time < nextWindowStart) {
          res.status(405).json({ error: 'Вы слишком рано' })
          return
        }
        if (claim_time > windowEnd) {
          res.status(406).json({ error: 'Вы опоздали' })
          burn_stake(user_id, stake_id, 'night')
          return
        }

        await t.none(
          `
            UPDATE govno_db.night_staking 
            SET days_completed = days_completed + 1, last_claim = $1
            WHERE user_id = $2 AND id = $3
            `,
          [claim_time, user_id, stake_id]
        )

        res.status(200).json({ last_claim: claim_time })
        return
      } else if (stake_type === 'super') {
        const row = await t.oneOrNone(
          `
          SELECT last_claim, deadline_time, days_completed, amount, potencial_win
          FROM govno_db.super_staking
          WHERE user_id = $1 AND id = $2 AND is_active = true AND burned = false
          `,
          [user_id, stake_id]
        )

        if (!row) {
          res.status(404).json({ error: 'Суперстейк не найден или не активен' })
          return
        }

        const lastClaimTime = new Date(row.last_claim)
        let deadlineTime = row.deadline_time
        // Вычисляем разницу между временем текущего клика и предыдущим кликом
        const timeDelay = claim_time.getTime() - lastClaimTime.getTime()

        // Переводим миллисекунды в минуты
        const minutesDelay = timeDelay / (1000 * 60) - 1440

        console.log(`Time elapsed: ${minutesDelay} minutes`)

        if (minutesDelay < 0) {
          res.status(405).json({ error: 'Еще не время' })
          return
        }
        console.log(`Time elapsed: ${minutesDelay} minutes`)

        if (minutesDelay >= deadlineTime) {
          res.status(406).json({ error: 'Ты обосрался с опозданием и стейк сгорел' })
          burn_stake(user_id, stake_id, 'super')
          return
        }
        deadlineTime -= minutesDelay

        if (deadlineTime < 0) {
          res.status(406).json({ error: 'Ты обосрался и стейк сгорел' })
          burn_stake(user_id, stake_id, 'super')
          return
        }
        console.log(`У тебя осталось `, deadlineTime)

        await t.none(
          `UPDATE govno_db.super_staking
           SET days_completed = days_completed + 1, last_claim = $1, deadline_time = $2
           WHERE user_id = $3 AND id = $4 `,
          [claim_time, deadlineTime, user_id, stake_id]
        )
        res.status(200).json({ last_claim: claim_time })
        return
      }
    })
  } catch (error) {
    console.error('Ошибка при обновлении стейкинга:', error)
    res.sendStatus(500)
  }
}

export const update_gambler_level = async (req: Request, res: Response) => {
  const { user_id, stake_id, stake_type } = req.body

  if (!user_id || !stake_id || !stake_type) {
    res.sendStatus(401)
    return
  }

  try {
    const claim_time = new Date()

    await db.tx(async (t) => {
      let raw
      if (stake_type === 'day') {
        const raw = await t.oneOrNone(
          `SELECT gambler_level, potencial_win, amount
           FROM govno_db.day_staking
           WHERE user_id = $1 AND id = $2`,
          [user_id, stake_id]
        )

        if (!raw) {
          res.status(404).json({ error: 'Ставка не найдена' })
          return
        }

        const currentLevel = raw.gambler_level
        const maxLevel = 2

        if (currentLevel >= maxLevel) {
          res.status(405).json('Нельзя выше обновиться')
          return
        }

        const newLevel = currentLevel + 1
        const win = parseFloat(raw.potencial_win)
        const amount = parseFloat(raw.amount)
        const newPotencialWin = (win - amount) * 2 + amount

        await t.none(
          `UPDATE govno_db.day_staking 
           SET gambler_level = $1, potencial_win = $2, days_completed = 0, last_claim = $5
           WHERE user_id = $3 AND id = $4`,
          [newLevel, newPotencialWin, user_id, stake_id, claim_time]
        )

        res.status(200).json(`Обновил до ${newLevel} уровня`)
        return
      } else if (stake_type === 'night') {
        const raw = await t.oneOrNone(
          `SELECT gambler_level, potencial_win, amount
           FROM govno_db.night_staking
           WHERE user_id = $1 AND id = $2`,
          [user_id, stake_id]
        )

        if (!raw) {
          res.status(404).json({ error: 'Ставка не найдена' })
          return
        }

        const currentLevel = raw.gambler_level
        const maxLevel = 3

        if (currentLevel >= maxLevel) {
          res.status(405).json('Нельзя выше обновиться')
          return
        }

        const newLevel = currentLevel + 1
        const win = parseFloat(raw.potencial_win)
        const amount = parseFloat(raw.amount)
        const newPotencialWin = (win - amount) * 2 + amount

        await t.none(
          `UPDATE govno_db.night_staking 
           SET gambler_level = $1, potencial_win = $2, days_completed = 0, last_claim = $5
           WHERE user_id = $3 AND id = $4`,
          [newLevel, newPotencialWin, user_id, stake_id, claim_time]
        )

        res.status(200).json(`Обновил до ${newLevel} уровня`)
        return
      } else if (stake_type === 'super') {
        raw = await t.oneOrNone(
          `
              SELECT gambler_level, potencial_win, amount, deadline_time
              FROM govno_db.super_staking
              WHERE user_id = $1 AND id = $2
              `,
          [user_id, stake_id]
        )
        if (!raw) {
          res.status(404).json({ error: 'Ставка не найдена' })
          return
        }
        if (raw.deadline_time < 1) {
          res.status(405).json(`Нельзя обновить уровень лудика, слишком мало времени`)
          return
        }
        const new_potencial_win = (parseFloat(raw.potencial_win) - parseFloat(raw.amount)) * 2 + parseFloat(raw.amount)
        const new_deadline_time = parseFloat(raw.deadline_time) / 2
        await t.none(
          `
          UPDATE govno_db.super_staking
          SET gambler_level = gambler_level + 1, potencial_win = $1, days_completed = 0, last_claim = $4, deadline_time = $5
          WHERE user_id = $2 AND id = $3`,
          [new_potencial_win, user_id, stake_id, claim_time, new_deadline_time]
        )
        res.status(200).json(`Обновил уровень до `)
      }
    })
  } catch (error) {
    console.error('Ошибка при обновлении уровня лудомании на +1', error)
    res.sendStatus(500)
  }
}

export const staking_cashout = async (req: Request, res: Response) => {
  const { user_id, stake_id, stake_type } = req.body

  if (!user_id || !stake_id) {
    res.sendStatus(401)
    return
  }

  try {
    await db.tx(async (t) => {
      let stake: { potencial_win: number; amount: number } | null = null

      if (stake_type === 'day') {
        stake = await t.oneOrNone(
          `
            UPDATE govno_db.day_staking 
            SET is_active = false, burned = false, claimed = true
            WHERE user_id = $1 
              AND id = $2 
              AND is_active = true
              AND burned = false
              AND claimed = false
              AND days_completed >= 10
            RETURNING potencial_win, amount
          `,
          [user_id, stake_id]
        )
      } else if (stake_type === 'super') {
        stake = await t.oneOrNone(
          `
            UPDATE govno_db.super_staking
            SET is_active = false, burned = false, claimed = true
            WHERE user_id = $1 
              AND id = $2 
              AND is_active = true
              AND burned = false
              AND claimed = false
              AND days_completed >= 10
            RETURNING potencial_win, amount
          `,
          [user_id, stake_id]
        )
      } else if (stake_type === 'night') {
        stake = await t.oneOrNone(
          `
            UPDATE govno_db.night_staking 
            SET is_active = false, burned = false, claimed = true
            WHERE user_id = $1 
              AND id = $2 
              AND is_active = true
              AND burned = false
              AND claimed = false
              AND days_completed >= 10
            RETURNING potencial_win, amount
          `,
          [user_id, stake_id]
        )
      }

      if (!stake) {
        res.sendStatus(403)
        return
      }

      const { potencial_win, amount } = stake
      const profit = amount - potencial_win

      await t.none(
        `
          UPDATE govno_db.users 
          SET balance = balance + $1
          WHERE tg_user_id = $2
        `,
        [potencial_win, user_id]
      )

      await t.none(
        `
          INSERT INTO govno_db.stake_platform_profits 
            (user_id, stake_id_${stake_type}, stake_type, action, payout, amount, profit)
          VALUES ($1, $2, $3, 'stake_cashout', $4, $5, $6)
        `,
        [user_id, stake_id, stake_type, potencial_win, amount, profit]
      )
    })

    res.sendStatus(200)
  } catch (error) {
    console.error('Ошибка при распределении денег со стейка: ', error)
    res.sendStatus(500)
  }
}

async function burn_stake(user_id: any, stake_id: any, stake_type: string) {
  try {
    if (isNaN(user_id) || isNaN(stake_id) || !stake_type) {
      console.error('Данные не валидны:', { user_id, stake_id, stake_type })
      return
    }

    await db.tx(async (t) => {
      let stake
      if (stake_type === 'day') {
        stake = await t.oneOrNone(`UPDATE govno_db.day_staking SET is_active = false, burned = true WHERE user_id = $1 AND id = $2  RETURNING amount`, [user_id, stake_id])
      } else if (stake_type === 'night') {
        stake = await t.oneOrNone(`UPDATE govno_db.night_staking SET is_active = false, burned = true WHERE user_id = $1 AND id = $2  RETURNING amount`, [user_id, stake_id])
      } else if (stake_type === 'super') {
        stake = await t.oneOrNone(`UPDATE govno_db.super_staking SET is_active = false, burned = true WHERE user_id = $1 AND id = $2 RETURNING amount`, [user_id, stake_id])
      }
      const { amount } = stake
      await t.none(
        `
          INSERT INTO govno_db.stake_platform_profits 
            (user_id, stake_id_${stake_type}, stake_type, action, payout, amount, profit)
          VALUES ($1, $2, $3, 'burn', $4, $5, $6)
        `,
        [user_id, stake_id, stake_type, 0, amount, amount]
      )
    })
  } catch (error) {
    console.error('Ошибка при сгорании стейка:', error)
  }
}

export async function check_stakes_to_burn() {
  try {
    return await db.tx(async (t) => {
      // Проверяем и сжигаем дневные стейки
      const burnedStakes = await t.any(`
        UPDATE govno_db.day_staking
        SET burned = TRUE,
            is_active = FALSE
        WHERE is_active = TRUE
          AND burned = FALSE
          AND claimed = FALSE
          AND last_claim IS NOT NULL
          AND NOW() > last_claim + INTERVAL '24 hours 30 minutes'
        RETURNING id, user_id, amount
      `)

      if (burnedStakes.length > 0) {
        console.log(`🔥 Сгорело ${burnedStakes.length} дневных стейков:`)

        // Добавляем информацию о сгоревших стейках в таблицу с профитом
        for (const stake of burnedStakes) {
          const { user_id, id: stake_id, amount } = stake

          // Запись о сгоревшем стейке
          await t.none(
            `
            INSERT INTO govno_db.stake_platform_profits 
              (user_id, stake_id_day, stake_type, action, payout, amount, profit)
            VALUES ($1, $2, 'day', 'burn', $3, $4, $5)
          `,
            [user_id, stake_id, 0, amount, amount]
          )

          console.log(`- user_id: ${user_id}, stake_id: ${stake_id}, amount: ${amount}`)
        }
      } else {
        console.log('✅ Нет сгоревших дневных стейков.')
      }

      // Проверяем и сжигаем ночные стейки
      const burnedNightStakes = await t.any(`
        UPDATE govno_db.night_staking
        SET burned = TRUE,
            is_active = FALSE
        WHERE is_active = TRUE
          AND burned = FALSE
          AND claimed = FALSE
          AND last_claim IS NOT NULL
          AND NOW() > last_claim + INTERVAL '24 hours 30 minutes'
        RETURNING id, user_id, amount
      `)

      if (burnedNightStakes.length > 0) {
        console.log(`🔥 Сгорело ${burnedNightStakes.length} ночных стейков:`)

        for (const stake of burnedNightStakes) {
          const { user_id, id: stake_id, amount } = stake

          await t.none(
            `
            INSERT INTO govno_db.stake_platform_profits 
              (user_id, stake_id_night, stake_type, action, payout, amount, profit)
            VALUES ($1, $2, 'night', 'burn', $3, $4, $5)
          `,
            [user_id, stake_id, 0, amount, amount]
          )

          console.log(`- user_id: ${user_id}, stake_id: ${stake_id}, amount: ${amount}`)
        }
      } else {
        console.log('✅ Нет сгоревших ночных стейков.')
      }

      // Проверяем и сжигаем суперстейки
      const burnedSuperStakes = await t.any(`
        UPDATE govno_db.super_staking
        SET burned = TRUE,
            is_active = FALSE
        WHERE is_active = TRUE
          AND burned = FALSE
          AND claimed = FALSE
          AND last_claim IS NOT NULL
          AND NOW() > last_claim + INTERVAL '24 hours 30 minutes'
        RETURNING id, user_id, amount
      `)

      if (burnedSuperStakes.length > 0) {
        console.log(`🔥 Сгорело ${burnedSuperStakes.length} суперстейков:`)

        for (const stake of burnedSuperStakes) {
          const { user_id, id: stake_id, amount } = stake

          await t.none(
            `
            INSERT INTO govno_db.stake_platform_profits 
              (user_id, stake_id_super, stake_type, action, payout, amount, profit)
            VALUES ($1, $2, 'super', 'burn', $3, $4, $5)
          `,
            [user_id, stake_id, 0, amount, amount]
          )

          console.log(`- user_id: ${user_id}, stake_id: ${stake_id}, amount: ${amount}`)
        }
      } else {
        console.log('✅ Нет сгоревших суперстейков.')
      }

      return {
        burnedStakes,
        burnedNightStakes,
        burnedSuperStakes,
      }
    })
  } catch (error) {
    console.error('Ошибка проверки стейков:', error)
  }
}
