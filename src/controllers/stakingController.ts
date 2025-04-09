import { Request, Response } from 'express'
import db from '../database/db'

const dotenv = require('dotenv')
dotenv.config()

export const create_day_staking = async (req: Request, res: Response) => {
  const { user_id, amount, last_claim } = req.body

  if (!user_id || !amount || !last_claim) {
    res.sendStatus(401)
    return
  }

  if (amount <= 0) {
    res.sendStatus(402)
    return
  }
  try {
    const last_claim = new Date()
    const potencial_win = amount + amount * 0.05
    await db.tx(async (t) => {
      await t.none(`INSERT INTO govno_db.day_staking(user_id, amount, potencial_win, last_claim)  VALUES($1, $2, $3, $4)`, [user_id, amount, potencial_win, last_claim])
    })
    res.sendStatus(200)
  } catch (error) {
    console.error('Ошибка при добавлении стейкинга:', error)
  }
}

export const get_day_staking_active = async (req: Request, res: Response) => {
  const { user_id } = req.query

  if (!user_id) {
    res.sendStatus(401)
    return
  }

  try {
    await db.tx(async (t) => {
      const stakes = await t.any(
        `SELECT id, amount, potencial_win, days_completed, is_active, last_claim, gambler_level
           FROM govno_db.day_staking 
           WHERE user_id = $1 AND is_active = TRUE AND burned = FALSE`,
        [user_id]
      )

      res.status(200).json(stakes) // ✅ исправлено здесь
    })
  } catch (error) {
    console.error('Ошибка при отправки стейкинга:', error)
    res.sendStatus(500) // внутреняя ошибка сервера
  }
}

export const update_day_staking = async (req: Request, res: Response) => {
  const { user_id, stake_id } = req.query

  if (!user_id || !stake_id) {
    res.sendStatus(401)
    return
  }

  try {
    const claim_time = new Date()

    await db.tx(async (t) => {
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
      let windowMinutes = 30
      if (level === 1) windowMinutes = 15
      else if (level >= 2) windowMinutes = 5

      const windowEnd = new Date(nextWindowStart.getTime() + windowMinutes * 60 * 1000)

      if (claim_time < nextWindowStart || claim_time > windowEnd) {
        res.status(403).json({ error: 'Вы не попали в окно подтверждения' })
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
    })
  } catch (error) {
    console.error('Ошибка при обновлении стейкинга:', error)
    res.sendStatus(500)
  }
}

export const update_gambler_level = async (req: Request, res: Response) => {
  const { user_id, stake_id } = req.body

  if (!user_id || !stake_id) {
    res.sendStatus(401)
    return
  }

  try {
    const claim_time = new Date()

    await db.tx(async (t) => {
      const raw = await t.oneOrNone(
        `
            SELECT gambler_level, potencial_win
            FROM govno_db.day_staking
            WHERE user_id = $1 AND id = $2
            `,
        [user_id, stake_id]
      )

      if (!raw) {
        res.status(404).json({ error: 'Ставка не найдена' })
        return
      }

      const level = parseInt(raw.gambler_level)

      if (level >= 2) {
        res.status(403).json({ error: 'Максимальный уровень достигнут' })
        return
      }

      let bonusMultiplier = 0
      if (level === 0) bonusMultiplier = 0.15
      else if (level === 1) bonusMultiplier = 0.2

      const bonus = raw.potencial_win * bonusMultiplier
      const newPotencialWin = raw.potencial_win + bonus

      await t.none(
        `
            UPDATE govno_db.day_staking 
            SET 
              amount = potencial_win,
              potencial_win = $1,
              days_completed = 0,
              gambler_level = gambler_level + 1,
              last_claim = $2
            WHERE user_id = $3 AND id = $4
            `,
        [newPotencialWin, claim_time, user_id, stake_id]
      )

      // Отправляем ответ с новой потенциальной суммой
      res.status(200).json({
        new_level: level + 1,
        new_potencial_win: newPotencialWin, // добавляем новую потенциальную сумму
      })
      console.log(`Повышен уровень: ${level} → ${level + 1}`)
    })
  } catch (error) {
    console.error('Ошибка при обновлении уровня лудомании:', error)
    res.sendStatus(500)
  }
}

export const day_staking_cashout = async (req: Request, res: Response) => {
  const { user_id, stake_id } = req.body

  if (!user_id || !stake_id) {
    res.sendStatus(401)
  }

  try {
    await db.tx(async (t) => {
      const stake = await t.oneOrNone(
        `
            UPDATE govno_db.day_staking 
            SET is_active = false, burned = false, claimed = true
            WHERE user_id = $1 
              AND id = $2 
              AND is_active = true
              AND burned = false
              AND claimed = false
              AND days_completed >= 10
            RETURNING potencial_win
            `,
        [user_id, stake_id]
      )

      if (!stake) {
        res.sendStatus(403)
        return
      }

      await t.none(
        `
            UPDATE govno_db.users 
            SET balance = balance + $1
            WHERE tg_user_id = $2
            `,
        [stake.potencial_win, user_id]
      )
    })

    res.sendStatus(200)
  } catch (error) {
    console.error('Ошибка при распределении денег с дневного стейка: ', error)
    res.sendStatus(500)
  }
}
