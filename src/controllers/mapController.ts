import { Request, Response } from 'express'
import db from '../database/db'

const dotenv = require('dotenv')
dotenv.config()

export const update_shit = async (req: Request, res: Response) => {
  const { initDataUnsafe, lat, lon, places_index } = req.body

  if (!initDataUnsafe || !lat || !lon || !places_index) {
    res.sendStatus(403)
    return
  }

  const user_id = initDataUnsafe?.user?.id

  try {
    await db.tx(async (t) => {
      // Получаем количество визитов и время последнего визита для текущего пользователя
      const result = await t.oneOrNone(
        `SELECT COUNT(*) AS visit_count, MAX(visit_time) AS last_visit_time
         FROM govno_db.govno_map 
         WHERE user_id = $1 AND date = CURRENT_DATE`,
        [user_id]
      )

      const visitCount = parseInt(result?.visit_count) || 0
      const lastVisitTime = result?.last_visit_time ? new Date(result.last_visit_time) : null
      const now = new Date()

      // Проверка на лимит количества визитов за день
      if (visitCount >= 5) {
        res.status(401).json({ message: 'Вы уже покакали 5 раз за день, хватит!' })
        return
      }

      // Проверка на интервал между визитами
      if (lastVisitTime) {
        const diffInMinutes = Math.floor((now.getTime() - lastVisitTime.getTime()) / 60000)
        if (diffInMinutes < 60) {
          res.status(429).json({ message: `Следующий поход в туалет доступен через ${60 - diffInMinutes} минут` })
          return
        }
      }

      // Получаем информацию о городе и стране по координатам
      const city = await getCityFromCoords(lat, lon)
      const country = await getCountryFromCoords(lat, lon)

      // Вставляем или обновляем данные о городе и стране в базу данных
      await t.one(
        `WITH 
          city_insert AS (
            INSERT INTO govno_db.govno_cities(city_name, lat, lon, shit_count) 
            VALUES($1, $2, $3, 1)
            ON CONFLICT (city_name) 
            DO UPDATE SET shit_count = govno_db.govno_cities.shit_count + 1
          ),
          country_insert AS (
            INSERT INTO govno_db.govno_countries(country_name, lat, lon, shit_count) 
            VALUES($4, $5, $6, 1)
            ON CONFLICT (country_name) 
            DO UPDATE SET shit_count = govno_db.govno_countries.shit_count + 1
          )
        SELECT 1;`, // Здесь добавляем SELECT 1 для завершения запроса
        [city, lat, lon, country, lat, lon]
      )

      // Сохраняем запись о визите в таблице govno_map
      await t.none(
        `INSERT INTO govno_db.govno_map(user_id, visit_lat, visit_lon, visit_count, date, visit_time, city)
         VALUES($1, $2, $3, $4, CURRENT_DATE, NOW(), $5)`,
        [user_id, lat, lon, visitCount + 1, city]
      )

      await db.none(
        `
        DO $$
        DECLARE
          uid BIGINT := $1;
        BEGIN
          UPDATE govno_db.users
          SET app_balance = app_balance + 0.01
          WHERE tg_user_id = uid;
      
          UPDATE govno_db.our_loss
          SET poop_payout = poop_payout - 0.01
          WHERE id = TRUE;

          IF NOT FOUND THEN
            INSERT INTO govno_db.our_loss (id, poop_payout)
            VALUES (TRUE, -0.01);
          END IF;
        END
        $$;
      `,
        [user_id]
      )

      if (places_index.length > 0) {
        const insertPromises = places_index.map((placeIndex: number) =>
          t.none(
            `INSERT INTO govno_db.near_position(user_id, place_index) 
             VALUES($1, $2)
             ON CONFLICT (user_id, place_index) DO NOTHING`,
            [user_id, placeIndex]
          )
        )
        await Promise.all(insertPromises)
      }

      res.sendStatus(200)
    })
  } catch (error) {
    console.error(error)
    res.status(500).send('Server error')
  }
}

export const get_shits = async (req: Request, res: Response) => {
  try {
    const shitMarks = await db.any(`SELECT visit_lat as lat, visit_lon as lon, shit_skin as skin, date FROM govno_db.govno_map ORDER BY date DESC`)
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
