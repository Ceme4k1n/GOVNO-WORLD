import { Request, Response } from 'express'
import db from '../database/db'

const dotenv = require('dotenv')
dotenv.config()

export const checkInactiveUsers = async () => {
  try {
    const lastLogin = new Date('2025-03-15 22:54:20.861') // Симуляция данных из БД

    const now = new Date() // Текущее время
    const tenSecondsAgo = new Date(now.getTime() - 10 * 1000) // Отнимаем 10 секунд

    if (lastLogin < tenSecondsAgo) {
      console.log('Пользователь не заходил более 10 секунд')
    } else {
      console.log('Пользователь заходил недавно')
    }
  } catch (error) {
    console.error('❌ Ошибка при проверке неактивных пользователей:', error)
  }
}

export const sendMessage = async (chatId: string, text: string) => {
  try {
    const response = await fetch(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
      }),
    })
  } catch (error) {
    console.error('Ошибка при отправке сообщения:', error)
  }
}
