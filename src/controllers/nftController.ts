import { Request, Response } from 'express'
import db from '../database/db'

const dotenv = require('dotenv')
dotenv.config()

export const checkInactiveUsers = async () => {
  try {
    const now = new Date()
    now.setHours(0, 0, 0, 0)

    const oneDayAgo = new Date(now)
    oneDayAgo.setDate(oneDayAgo.getDate() - 1)
    console.log(oneDayAgo)

    const oneWeekAgo = new Date(now)
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    console.log(oneWeekAgo)

    const oneMonthAgo = new Date(now)
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    console.log(oneMonthAgo)

    const users = await db.any(
      `SELECT u.tg_user_id, u.last_login
       FROM govno_db.users u
       LEFT JOIN govno_db.reminder_logs r ON u.tg_user_id = r.user_id
       WHERE (u.last_login <= $1 AND r.reminder_type IS DISTINCT FROM 'day')
          OR (u.last_login <= $2 AND r.reminder_type IS DISTINCT FROM 'week')
          OR (u.last_login <= $3 AND r.reminder_type IS DISTINCT FROM 'month')`,
      [oneDayAgo, oneWeekAgo, oneMonthAgo]
    )

    for (const user of users) {
      let message = ''
      let reminderType = ''

      if (user.last_login <= oneMonthAgo) {
        message = 'Мы вас давно не видели, кажется у вас запор! Открывайте приложение. Месяц'
        reminderType = 'month'
      } else if (user.last_login <= oneWeekAgo) {
        message = 'Мы вас давно не видели, кажется у вас запор! Открывайте приложение. Неделя'
        reminderType = 'week'
      } else if (user.last_login <= oneDayAgo) {
        message = 'Мы вас давно не видели, кажется у вас запор! Открывайте приложение. День'
        reminderType = 'day'
      }

      if (message) {
        await sendMessage(user.tg_user_id, message)
        await db.none(
          `INSERT INTO govno_db.reminder_logs (user_id, reminder_type) 
           VALUES ($1, $2) 
           ON CONFLICT (user_id) DO UPDATE 
           SET reminder_type = EXCLUDED.reminder_type`,
          [user.tg_user_id, reminderType]
        )
      }
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
