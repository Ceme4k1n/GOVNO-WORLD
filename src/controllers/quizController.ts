import { Request, Response } from 'express'
import db from '../database/db'

const dotenv = require('dotenv')
dotenv.config()

interface Result {
  questionNumber: number
  correct: boolean
}

export const quiz_answers = (req: Request, res: Response) => {
  const { answers } = req.body

  let score = 0
  const results: Result[] = []

  if (!Array.isArray(answers)) {
    res.status(400).json({ error: 'Неверный формат данных' })
    return
  }

  answers.forEach(({ questionNumber, answer }) => {
    let correct = false
    let correctAnswer = 'Не найден'

    switch (questionNumber) {
      case 1:
        if (answer >= 150 && answer <= 250) correct = true
        break
      case 2:
        if (answer >= 3 && answer <= 15) correct = true
        break
      case 3:
        if (answer == 6) correct = true
        break
      case 4:
        if (answer >= 30 && answer <= 50) correct = true
        break
      case 5:
        if (answer.trim().toLowerCase() === 'синий кит') correct = true
        break
      case 6:
        if (answer.trim().toLowerCase() === 'запор') correct = true
        break
      case 7:
        if (answer == 1500000) correct = true
        break
      case 8:
        if (answer == 1) correct = true
        break
      case 9:
        if (answer >= 1 && answer <= 3) correct = true
        break
      case 10:
        if (answer.trim().toLowerCase() === 'ленивца') correct = true
        break
    }

    if (correct) score++

    results.push({ questionNumber, correct })
  })

  console.log(results)
  console.log(score)

  res.status(200).json({ score: score })
}
