import { Request, Response } from 'express'
import db from '../database/db'

const dotenv = require('dotenv')
dotenv.config()

export const generate_news = async () => {
  try {
    const prompt = `
    $GOVNO — это криптовалюта.Сгенерируй три **сумасшедшие**, **абсурдные** и **сатирические** новости про $GOVNO в духе коротких заголовков.
    Примеры стиля:      
    1. "Госдума предложила платить налоги в $GOVNO. Бюджет наполняется рекордными темпами!"  
    2. "Венесуэла признала $GOVNO официальной валютой! Доллар в опасности."  
    3. "Forbes: $GOVNO — единственная крипта, растущая в кризис. Эксперты в шоке!"
    4. "Маск признал, что Dogecoin – херня, теперь верит только в $GOVNO!"
    5. "Аналитики Bloomberg: $GOVNO – новая нефть! Инвесторы скупают $GOVNO."
    6. "Британские ученые подтвердили, что $GOVNO – основной индикатор успеха."
    
    Сгенерируй три новые новости, взрывающие мозг, связанные с криптовалютой и мировой экономикой.  
    Каждая новость должна быть абсурдной, сумасшедшей, не более 100 символов.  
    Будь как можно более **гиперболизированным** и **абсурдным**!
    `

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
        max_tokens: 200,
      }),
    })
    const data = await gpt_response.json()
    let news = data.choices[0].message.content.split('\n').filter((n: string) => n)
    try {
      for (let i = 0; i < news.length; i++) {
        await db.none('UPDATE govno_db.news SET content = $1 WHERE id = $2', [news[i], i + 1])
      }
    } catch (error) {
      console.error('Ошибка при записи новостей в БД:', error)
    }

    console.log(data.choices[0].message.content.split('\n').filter((n: string) => n))
  } catch (error) {
    console.error('Ошибка при генерации новостей:', error)
  }
}

export const get_news = async (req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0] // Текущая дата
    console.log(today)
    const news = await db.any(`SELECT * FROM govno_db.news`)
    console.log(news)

    res.status(200).json({ news, data: today })
  } catch (error) {
    console.error('Ошибка при получении новостей из БД:', error)
  }
}
