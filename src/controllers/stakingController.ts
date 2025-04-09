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
      const row = await t.oneOrNone(`SELECT last_claim FROM govno_db.day_staking WHERE user_id = $1 AND id = $2`, [user_id, stake_id])

      if (!row) {
        res.status(404).json({ error: 'Стейкинг не найден' })
        return
      }

      const lastClaimTime = new Date(row.last_claim)

      // Создаём начало следующего окна — ровно через сутки от последнего claim
      const nextWindowStart = new Date(lastClaimTime)
      nextWindowStart.setDate(nextWindowStart.getDate() + 1)

      // Конец окна = +30 минут от старта
      const windowEnd = new Date(nextWindowStart)
      windowEnd.setMinutes(windowEnd.getMinutes() + 30)

      // Проверка попадания во временное окно
      if (claim_time < nextWindowStart || claim_time > windowEnd) {
        res.status(403).json({ error: 'Вы не попали в окно подтверждения' })
        return
      }

      // Обновляем запись
      await t.none(`UPDATE govno_db.day_staking SET days_completed = days_completed + 1, last_claim = $1 WHERE user_id = $2 AND id = $3`, [claim_time, user_id, stake_id])

      res.status(200).json({ last_claim: claim_time })
    })
  } catch (error) {
    console.error('Ошибка при обновлении стейкинга:', error)
    res.sendStatus(500)
  }
}

export const update_gambler_level = async (req: Request, res: Response) => {
  const { user_id, stake_id, answer } = req.body
  if (!user_id || !stake_id) {
    res.sendStatus(401)
    return
  }

  try {
    const claim_time = new Date()

    await db.tx(async (t) => {
      const raw = await t.oneOrNone(`SELECT gambler_level FROM govno_db.day_staking WHERE user_id = $1 AND id = $2`, [user_id, stake_id])

      if (raw.gambler_level == 3) {
        res.sendStatus(401)
        return
      }
      console.log(`Старый уровень лудомании: `, raw.gambler_level)

      if (answer) {
        await t.none(`UPDATE govno_db.day_staking SET days_completed = 0, gambler_level = gambler_level + 1, last_claim = $1 WHERE user_id = $2 AND id = $3`, [claim_time, user_id, stake_id])
        res.status(200).json(raw.gambler_level + 1)
        console.log(`Новый уровень лудомании: `, raw.gambler_level + 1)
      } else {
        //Пока ничего, но добавить функцию вывода денег
      }
      res.sendStatus(200)
    })
  } catch (error) {
    console.error('Ошибка при обновлении уровня лудомании:', error)
    res.sendStatus(500)
  }
}
