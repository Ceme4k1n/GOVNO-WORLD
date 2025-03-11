import { Request, Response } from 'express'
const dotenv = require('dotenv')
dotenv.config()

const TG_TOKEN = process.env.TG_TOKEN || 'test'

export const validate_user = (req: Request, res: Response) => {
  const initData = req.body.initData

  if (!initData) {
    res.status(403).json({ error: 'No initData' })
    console.log('No initData')
  } else {
    console.log('Goyda')
  }
}
