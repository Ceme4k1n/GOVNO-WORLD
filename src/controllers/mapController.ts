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

    console.log(countResult[0].count)

    const visitCount = parseInt(countResult[0].count)
  } catch (error) {
    console.error(error)
    res.status(500).send('Server error')
  }
}
