import { Request, Response } from 'express'
import db from '../database/db'

const dotenv = require('dotenv')
dotenv.config()

export const generate_turn = async () => {
  try {
    // Получаем топ 20 городов по количеству покаков (или по нужной вам метрике)
    const cities = await db.any(`
        SELECT city_name
        FROM govno_db.govno_cities 
        ORDER BY shit_count DESC 
        LIMIT 20
      `)

    if (cities.length < 2) {
      console.log('Недостаточно городов для турниров')
      return
    }

    if (cities.length % 2 !== 0) {
      cities.pop()
    }

    let tournaments = []
    let numTournaments = cities.length / 2

    for (let i = 0; i < cities.length; i += 2) {
      const city1 = cities[i]
      const city2 = cities[i + 1]

      tournaments.push({
        city1: city1.city_name,
        city2: city2.city_name,
        total_bets1: 0, // Изначально нет ставок
        total_bets2: 0, // Изначально нет ставок
        price1: 1.0, // Изначальная цена голоса на 1-й город
        price2: 1.0, // Изначальная цена голоса на 2-й город
        spread: 0.02, // Начальный спред (2%)
        status: 'active', // Статус турнира
      })
    }

    const insertQuery = `
        INSERT INTO govno_db.tournaments 
        (city1, city2, total_bets1, total_bets2, price1, price2, spread, status) 
        VALUES ${tournaments.map((t) => `('${t.city1}', '${t.city2}', ${t.total_bets1}, ${t.total_bets2}, ${t.price1}, ${t.price2}, ${t.spread}, '${t.status}')`).join(', ')}
      `

    await db.none(insertQuery)

    console.log(`✅ Успешно создано ${numTournaments} турниров!`)
  } catch (error) {
    console.error('❌ Ошибка при генерации турниров:', error)
  }
}

export const get_all_turns = async (req: Request, res: Response) => {
  try {
    const turns = await db.any(`SELECT * FROM govno_db.tournaments`)
    console.log(turns)

    res.status(200).json(turns)
  } catch (error) {
    console.error(error)
    res.status(500).send('Server error')
  }
}
