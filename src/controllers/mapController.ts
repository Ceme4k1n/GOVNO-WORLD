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
    const result = await db.oneOrNone(
      `SELECT COUNT(*) AS visit_count, MAX(visit_time) AS last_visit_time
       FROM govno_db.govno_map 
       WHERE user_id = $1 AND date = CURRENT_DATE`,
      [user_id]
    )

    const visitCount = parseInt(result?.visit_count) || 0
    const lastVisitTime = result?.last_visit_time ? new Date(result.last_visit_time) : null
    const now = new Date()

    if (visitCount >= 5) {
      res.status(401).json({ message: 'Вы уже покакали 5 раз за день, хватит!' })
      return
    }

    if (lastVisitTime) {
      const diffInMinutes = Math.floor((now.getTime() - lastVisitTime.getTime()) / 60000)
      if (diffInMinutes < 60) {
        res.status(429).json({ message: `Следующий поход в туалет доступен через ${60 - diffInMinutes} минут` })
        return
      }
    }

    const city = await getCityFromCoords(lat, lon)
    const country = await getCountryFromCoords(lat, lon)

    const govno = await db.one(
      `WITH 
        city_insert AS (
          INSERT INTO govno_db.govno_cities(city_name, lat, lon, shit_count) 
          VALUES($1, $2, $3, 1)
          ON CONFLICT (city_name) 
          DO UPDATE SET shit_count = govno_db.govno_cities.shit_count + 1 
          RETURNING city_id
        ),
        country_insert AS (
          INSERT INTO govno_db.govno_countries(country_name, lat, lon, shit_count) 
          VALUES($4, $5, $6, 1)
          ON CONFLICT (country_name) 
          DO UPDATE SET shit_count = govno_db.govno_countries.shit_count + 1 
          RETURNING country_id
        )
      SELECT city_insert.city_id, country_insert.country_id
      FROM city_insert, country_insert;`,
      [city, lat, lon, country, lat, lon]
    )

    console.log('City ID:', govno.city_name)
    console.log('Country ID:', govno.country_name)

    // Сохраняем запись в БД
    await db.none(
      `INSERT INTO govno_db.govno_map(user_id, visit_lat, visit_lon, visit_count, date, visit_time, city)
       VALUES($1, $2, $3, $4, CURRENT_DATE, NOW(), $5)`,
      [user_id, lat, lon, visitCount + 1, city]
    )

    res.sendStatus(200)
  } catch (error) {
    console.error(error)
    res.status(500).send('Server error')
  }
}

export const get_shits = async (req: Request, res: Response) => {
  try {
    const shitMarks = await db.any(`SELECT visit_lat as lat, visit_lon as lon, date FROM govno_db.govno_map ORDER BY date DESC`)
    console.log(shitMarks)

    res.status(200).json({ shits: shitMarks })
  } catch (error) {
    console.error(error)
    res.status(500).send('Server error')
  }
}

export const get_top_shit_cities = async (req: Request, res: Response) => {
  try {
    const topCities = await db.any(`SELECT city_name as city, lat, lon, shit_count FROM govno_db.govno_cities ORDER BY shit_count DESC LIMIT 10`)

    console.log(topCities)
    res.json({ cities: topCities })
  } catch (error) {
    console.error(error)
    res.status(500).send('Server error')
  }
}

export const get_top_shit_countries = async (req: Request, res: Response) => {
  try {
    const topCountries = await db.any(`SELECT country_name as country, lat, lon, shit_count FROM govno_db.govno_countries ORDER BY shit_count DESC LIMIT 10`)

    console.log(topCountries)
    res.json({ countries: topCountries })
  } catch (error) {
    console.error(error)
    res.status(500).send('Server error')
  }
}

async function getCityFromCoords(lat: number, lon: number) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`

  try {
    const response = await fetch(url)
    const data = await response.json()

    if (data.address && data.address.city) {
      return data.address.city
    } else if (data.address && data.address.town) {
      return data.address.town
    } else if (data.address && data.address.village) {
      return data.address.village
    } else {
      return 'Неизвестный город'
    }
  } catch (error) {
    console.error('Ошибка при получении города:', error)
    return 'Ошибка'
  }
}

async function getCountryFromCoords(lat: number, lon: number) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`

  try {
    const response = await fetch(url)
    const data = await response.json()

    if (data.address && data.address.country) {
      return data.address.country
    } else {
      return 'Неизвестная страна'
    }
  } catch (error) {
    console.error('Ошибка при получении страны:', error)
    return 'Ошибка'
  }
}
