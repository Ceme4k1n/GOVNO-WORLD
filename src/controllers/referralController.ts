import { Request, Response } from 'express'
import db from '../database/db'

const dotenv = require('dotenv')
dotenv.config()

export const get_referrals = async (req: Request, res: Response) => {
  const { tg_user_id } = req.body

  if (!tg_user_id) {
    res.sendStatus(403)
    return
  }

  try {
    const referrals = await db.any(`SELECT friend_username, created_at FROM govno_db.referrals WHERE referral_id = $1`, [tg_user_id])

    console.log(referrals)

    res.status(200).json({ referrals })
  } catch (error) {
    console.error(error)
    res.status(501).json({ error: 'Database error' })
  }
}
