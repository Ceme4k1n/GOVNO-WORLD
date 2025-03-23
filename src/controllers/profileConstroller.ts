import { Request, Response } from 'express'
import db from '../database/db'

const dotenv = require('dotenv')
dotenv.config()

export const get_data = async (req: Request, res: Response) => {
  const { initDataUnsafe } = req.body

  if (!initDataUnsafe) {
    res.status(403).json({ error: 'initDataUnsafe is required' })
    return
  }

  const user_id = initDataUnsafe?.user?.id

  try {
    const result = await db.any('SELECT user_age, user_height, user_weight, user_sex, user_eat, user_toilet_visits FROM govno_db.users WHERE tg_user_id = $1', [user_id])
    console.log(result)
    if (result.length > 0) {
      res.status(200).json({ result })
    }
  } catch (error) {
    console.error('Ошибка бд:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
}

export const update_user_data = async (req: Request, res: Response) => {
  try {
    const { updatedData, initDataUnsafe } = req.body
    if (!updatedData || !initDataUnsafe) {
      res.sendStatus(402)
      return
    }

    const user_id = initDataUnsafe?.user?.id
    if (!user_id) {
      res.sendStatus(400)
      return
    }

    const dietMap = {
      balanced: 0,
      carnivore: 1,
      vegan: 2,
      omnivore: 3,
    } as const

    const user_eat = dietMap[updatedData.user_eat as keyof typeof dietMap] ?? 4

    const validationRules = [
      { value: updatedData.user_age, min: 5, max: 100, field: 'user_age' },
      { value: updatedData.user_height, min: 80, max: 250, field: 'user_height' },
      { value: updatedData.user_weight, min: 30, max: 300, field: 'user_weight' },
      { value: updatedData.user_toilet_visits, min: 1, max: 10, field: 'user_toilet_visits' },
    ]

    for (const { value, min, max, field } of validationRules) {
      if (value < min || value > max) {
        console.warn(`Invalid ${field}: ${value}`)
        res.sendStatus(400)
        return
      }
    }

    await db.none(
      `UPDATE govno_db.users 
         SET user_age = $1, user_height = $2, user_weight = $3, user_sex = $4, user_eat = $5, user_toilet_visits = $6 
         WHERE tg_user_id = $7`,
      [updatedData.user_age, updatedData.user_height, updatedData.user_weight, updatedData.user_sex, user_eat, updatedData.user_toilet_visits, user_id]
    )

    res.sendStatus(200)
  } catch (error) {
    console.error('Ошибка БД:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
}
