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
    const countResult = await db.query(`SELECT COUNT(*) FROM govno_db.govno_map WHERE user_id = $1 AND date = CURRENT_DATE`, [user_id])

    const visitCount = parseInt(countResult.rows[0].count)

    if (visitCount < 5) {
      await db.query('INSERT INTO govno_db.govno_map (user_id, visit_lat, visit_lon, visit_count, date) ' + 'VALUES ($1, $2, $3, $4, CURRENT_DATE)', [user_id, lat, lon, visitCount + 1])
      res.sendStatus(200)
    } else {
      res.status(401).send('Max pokakov')
    }
  } catch (error) {
    console.error(error)
    res.status(500).send('Server error')
  }
}
