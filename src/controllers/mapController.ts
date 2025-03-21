import { Request, Response } from 'express'
import db from '../database/db'

const dotenv = require('dotenv')
dotenv.config()

export const update_shit = async (req: Request, res: Response) => {
  const { initDataUnsafe, lat, lon } = req.body

  if (!initDataUnsafe) {
    res.sendStatus(403)
    return
  }

  const user_id = initDataUnsafe?.user?.id

  try {
    const result = await db.oneOrNone(
      `SELECT COUNT(*) AS visit_count, MAX(visit_time) AS last_visit_time
       FROM govno_db.govno_map 
       WHERE user_id = $1 AND date = CURRENT_DATE`,
      [user_id]
    )

    const visitCount = parseInt(result?.visit_count) || 0
    const lastVisitTime = result?.last_visit_time ? new Date(result.last_visit_time) : null
    const now = new Date()

    if (visitCount >= 5) {
      res.status(401).json({ message: 'Вы уже покакали 5 раз за день, хватит!' })
      return
    }

    if (lastVisitTime) {
      const diffInMinutes = Math.floor((now.getTime() - lastVisitTime.getTime()) / 60000)
      if (diffInMinutes < 60) {
        res.status(429).json({ message: `Следующий поход в туалет доступен через ${60 - diffInMinutes} минут` })
        return
      }
    }

    // Сохраняем запись в БД
    await db.none(
      `INSERT INTO govno_db.govno_map(user_id, visit_lat, visit_lon, visit_count, date, visit_time)
       VALUES($1, $2, $3, $4, CURRENT_DATE, NOW())`,
      [user_id, lat, lon, visitCount + 1]
    )

    res.sendStatus(200)
  } catch (error) {
    console.error(error)
    res.status(500).send('Server error')
  }
}

export const get_shits = async (req: Request, res: Response) => {
  const { initDataUnsafe } = req.body

  if (!initDataUnsafe) {
    res.sendStatus(401)
    return
  }

  const user_id = initDataUnsafe?.user?.id

  try {
    const shitMarks = await db.any(`SELECT visit_lat as lat, visit_lon as lon, date FROM govno_db.govno_map WHERE user_id = $1 ORDER BY date DESC`, [user_id])
    console.log(shitMarks)

    res.status(200).json({ shits: shitMarks })
  } catch (error) {
    console.error(error)
    res.status(500).send('Server error')
  }
}
