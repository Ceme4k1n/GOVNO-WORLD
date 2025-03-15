import express from 'express'
import { get_news } from '../controllers/newsController'

const router = express.Router()

router.get('/get_news', get_news)

export default router
