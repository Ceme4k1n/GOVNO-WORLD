import { Request, Response } from 'express'
import db from '../database/db'

export const get_all_skins = async (req: Request, res: Response) => {
  try {
    await db.tx(async (t) => {
      const skins = await t.any(`SELECT * FROM govno_db.skins_data`)

      res.status(200).send(skins)
    })
  } catch (error) {
    console.error('Ошибка получении скинов:', error)
    res.sendStatus(500)
  }
}

export const purchase_skin = async (req: Request, res: Response) => {
  const { user_id, skin_id } = req.body

  if (!user_id || !skin_id) {
    res.sendStatus(400)
    return
  }

  console.log('Попытка покупки:', req.body)

  try {
    const result = await db.tx(async (t) => {
      return await t.result(
        `
          WITH 
            skin_cte AS (
              SELECT id, skin_price
              FROM govno_db.skins_data
              WHERE id = $2 AND skin_emission > 0
            ),
            update_user AS (
              UPDATE govno_db.users
              SET balance = balance - (SELECT skin_price FROM skin_cte)
              WHERE tg_user_id = $1 AND balance >= (SELECT skin_price FROM skin_cte)
              RETURNING tg_user_id
            ),
            update_emission AS (
              UPDATE govno_db.skins_data
              SET skin_emission = skin_emission - 1
              WHERE id = $2 AND EXISTS (SELECT 1 FROM update_user)
              RETURNING id
            )
          INSERT INTO govno_db.user_skins (user_id, skin_id)
          SELECT $1, $2
          FROM update_user, update_emission
          `,
        [user_id, skin_id]
      )
    })

    if (result.rowCount === 0) {
      res.sendStatus(403)
      return
    }

    res.sendStatus(200)
  } catch (error) {
    console.error('Ошибка покупки скина:', error)
    res.sendStatus(500)
  }
}
