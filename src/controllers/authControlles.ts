import { Request, Response } from 'express'
import crypto from 'crypto'
import db from '../database/db'

const dotenv = require('dotenv')
dotenv.config()

const BOT_TOKEN = process.env.TG_TOKEN || 'test'
const MAX_TIME_DIFF = 300 // 5 минут
const secretKey = crypto.createHmac('sha256', Buffer.from('WebAppData', 'utf-8')).update(BOT_TOKEN).digest()

export const validate_user = async (req: Request, res: Response) => {
  const { initData, initDataUnsafe } = req.body
  const user_id = initDataUnsafe?.user?.id

  console.log('🔍 Проверка пользователя:', user_id)

  if (!initData) {
    res.status(403).json({ error: 'initData is required' })
    return
  }

  const validationResult = validateInitData(initData)

  if (validationResult.error) {
    res.status(validationResult.status).json({ error: validationResult.error })
    return
  }

  try {
    // Обновляем last_login + обнуляем reminder_type в одном запросе
    const updatedUser = await db.oneOrNone(
      `
      WITH updated_user AS (
        UPDATE govno_db.users 
        SET last_login = NOW() 
        WHERE tg_user_id = $1 
        RETURNING tg_user_id
      ), updated_reminders AS (
        UPDATE govno_db.reminder_logs 
        SET reminder_type = NULL 
        WHERE user_id = $1
        RETURNING user_id
      )
      SELECT COALESCE((SELECT tg_user_id FROM updated_user), (SELECT tg_user_id FROM govno_db.users WHERE tg_user_id = $1)) AS user_id;
      `,
      [user_id]
    )

    if (!updatedUser || !updatedUser.user_id) {
      console.log('⚠️ Пользователь не найден:', user_id)
      res.status(200).json({ message: 'User not found' })
      return
    }

    console.log('✅ Пользователь найден и обновлён:', user_id)
    res.status(201).json({ message: 'User already exists' })
  } catch (error) {
    console.error('❌ Ошибка при обработке запроса:', error)
    res.status(500).json({ error: 'Database error' })
  }
}

export const user_reg = async (req: Request, res: Response) => {
  const { initDataUnsafe, user_age, user_height, user_weight, user_sex, user_toilet_visits } = req.body
  let { referredId } = req.body
  if (!initDataUnsafe) {
    console.log('Нет даты')
    return
  }
  const user_id = initDataUnsafe.user.id
  const username = initDataUnsafe.user.username
  if (referredId == user_id) {
    referredId = 'None'
  }

  if (user_age && user_height && user_weight && user_toilet_visits) {
    try {
      await db.tx(async (t) => {
        await t.none(
          `INSERT INTO govno_db.users (tg_user_id, username, user_age, user_height, user_weight, user_sex, user_toilet_visits, last_login)
          VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
          ON CONFLICT (tg_user_id) DO NOTHING;`,
          [user_id, username, user_age, user_height, user_weight, user_sex, user_toilet_visits]
        )

        // Проверка, что реферал существует в таблице users
        if (referredId !== 'None') {
          const referredUser = await t.oneOrNone(`SELECT username FROM govno_db.users WHERE tg_user_id = $1`, [referredId])

          if (referredUser) {
            await t.none(
              `INSERT INTO govno_db.referrals (referral_id, friend_id, friend_username, created_at)
              VALUES ($1, $2, $3, NOW())`,
              [referredId, user_id, referredUser.username]
            )
            console.log(`Пользователь добавлен с рефералом от ${referredUser.username ? '@' + referredUser.username : 'неизвестного пользователя'}`)
          } else {
            console.log('Реферал не найден, добавлен без реферала')
          }
        } else {
          console.log('Пользователь добавлен без реферала')
        }
      })

      res.sendStatus(200)
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
    console.error('❌ Ошибка: hash не найден')
    return { error: 'No hash provided', status: 400 }
  }

  console.log('✅ Hash найден:', hash)

  params.delete('hash')

  const dataCheckString = Array.from(params.entries())
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join('\n')

  const generatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  console.log('🔍 Сгенерированный hash:', generatedHash)

  if (generatedHash !== hash) {
    console.error('❌ Ошибка: hash не совпадает!')
    return { error: 'Invalid hash, data might be forged', status: 403 }
  }

  const authDate = parseInt(params.get('auth_date') || '0', 10)
  const currentTime = Math.floor(Date.now() / 1000)

  if (currentTime - authDate > MAX_TIME_DIFF) {
    console.error('❌ Ошибка: данные слишком старые!')
    return { error: 'Data is too old', status: 403 }
  }

  return { success: true }
}
