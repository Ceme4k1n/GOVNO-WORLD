import { Request, Response } from 'express'
import db from '../database/db'

const dotenv = require('dotenv')
dotenv.config()

export const generate_news = async () => {
  try {
    const prompt = `
    $GOVNO — это криптовалюта. Сгенерируй три **сумасшедшие**, **абсурдные** и **сатирические** новости про $GOVNO в следующем формате JSON:
    [
      {
        "title": "Госдума предложила платить налоги в $GOVNO!",
        "content": "Правительство рассматривает $GOVNO как главную валюту страны. Эксперты в шоке!",
        "source": "Известия"
      },
      {
        "title": "Маск заявил, что $GOVNO - будущее крипты!",
        "content": "Илон Маск официально отказался от Dogecoin в пользу $GOVNO. Мир криптовалют потрясен!",
        "source": "Forbes"
      },
      {
        "title": "Аналитики Bloomberg признали $GOVNO новой нефтью!",
        "content": "Инвесторы массово скупают $GOVNO, прогнозируя рост на 5000% в следующем квартале!",
        "source": "Bloomberg"
      }
    ]
    
    Сгенерируй три новые новости в таком же формате, в JSON-массиве.`

    const gpt_response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'Ты сатирический новостной бот, генерирующий абсурдные новости.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 500,
      }),
    })

    const data = await gpt_response.json()
    let news = JSON.parse(data.choices[0].message.content)
    try {
      for (let i = 0; i < 3; i++) {
        await db.none('UPDATE govno_db.news SET title = $1, content = $2, source = $3 WHERE id = $4', [news[i].title, news[i].content, news[i].source, i + 1])
      }
    } catch (error) {
      console.error('Ошибка при обновлении новостей в БД:', error)
    }

    console.log(news)
  } catch (error) {
    console.error('Ошибка при генерации новостей:', error)
  }
}

export const get_news = async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0] // Текущая дата
    console.log('Дата на сервере:', today)

    // Получаем ровно 3 новости
    const news = await db.any('SELECT * FROM govno_db.news ORDER BY id LIMIT 3')

    console.log('Отправляем новости:', news)

    res.status(200).json({ news, date: today }) // исправил "data" на "date" для логичности
  } catch (error) {
    console.error('Ошибка при получении новостей из БД:', error)
    res.status(500).json({ error: 'Ошибка сервера' })
  }
}
