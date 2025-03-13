import express from 'express'
import { quiz_answers } from '../controllers/quizController'

const router = express.Router()

router.post('/submit', quiz_answers)

export default router
