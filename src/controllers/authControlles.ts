import { Request, Response } from 'express'
import crypto from 'crypto'
import db from '../database/db'

const dotenv = require('dotenv')
dotenv.config()

const BOT_TOKEN = process.env.TG_TOKEN || 'test'
const MAX_TIME_DIFF = 300 // 5 минут

export const validate_user = async (req: Request, res: Response) => {
  const { initData, initDataUnsafe } = req.body
  const user_id = initDataUnsafe.user.id
  console.log(initData)
  console.log(user_id)

  if (!initData) {
    res.status(403).json({ error: 'initData is required' })
    return
  }

  const validationResult = validateInitData(initData)

  if (validationResult.error) {
    res.status(validationResult.status).json({ error: validationResult.error })
  }

  // Если данные прошли валидацию
  res.json({ success: true, message: 'User validated' })
}

export const user_reg = async (req: Request, res: Response) => {
  const { eater, weight, age, height, toilet_visits, gender, initDataUnsafe } = req.body

  const user_id = initDataUnsafe.user.id
  const username = initDataUnsafe.user.username

  if (weight && age && height && toilet_visits) {
    try {
      const user = await db.any('SELECT username FROM govno_db.users WHERE tg_user_id = $1', [user_id])
      if (user.length > 0) {
        res.status(502).json({ message: 'User alredy exist', user })
        console.log('Юзер существует: ', user)
        return
      } else {
        await db.none('INSERT INTO govno_db.users(tg_user_id, username, user_age, user_height, user_weight, user_sex, user_eat, user_toilet_visits) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [user_id, username, age, height, weight, gender, eater, toilet_visits])
        console.log('Пользователь добавлен')
      }
    } catch (error) {
      console.error(error)
      res.status(501).json({ error: 'Database error' })
    }
  }
}

// Функция для валидации данных initData
export const validateInitData = (initData: string) => {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) {
    return { error: 'No hash provided', status: 400 }
  }

  params.delete('hash')

  const dataCheckString = Array.from(params.entries())
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n')

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest()

  const generatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (generatedHash !== hash) {
    return { error: 'Invalid hash, data might be forged', status: 403 }
  }

  const authDate = parseInt(params.get('auth_date') || '0', 10)
  const currentTime = Math.floor(Date.now() / 1000)

  if (currentTime - authDate > MAX_TIME_DIFF) {
    return { error: 'Data is too old', status: 403 }
  }
  return { success: true }
}
