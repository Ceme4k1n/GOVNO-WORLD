import { Request, Response } from 'express'
import db from '../database/db'

const dotenv = require('dotenv')
dotenv.config()

export const get_referrals = async (req: Request, res: Response) => {
  const { user_id } = req.body

  if (!user_id) {
    res.sendStatus(403)
    return
  }

  try {
    const friends_usernames = await db.any(
      `SELECT u.username
       FROM govno_db.referrals r
       JOIN govno_db.users u ON r.friend_id = u.tg_user_id
       WHERE r.referral_id = $1;`,
      [user_id]
    )

    if (friends_usernames.length > 0) {
      const referralNames = friends_usernames.map((ref) => ref.username)
      res.status(200).json({ referralNames })
    } else {
      res.sendStatus(201)
    }
  } catch (error) {
    console.error(error)
    res.status(501).json({ error: 'Database error' })
  }
}
