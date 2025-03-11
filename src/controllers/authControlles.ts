import { Request, Response } from 'express'
import crypto from 'crypto'

const dotenv = require('dotenv')
dotenv.config()

const BOT_TOKEN = process.env.TG_TOKEN || 'test'
const MAX_TIME_DIFF = 300 // 5 минут

export const validate_user = (req: Request, res: Response) => {
  const initData = req.body?.initData
  console.log(initData)

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
