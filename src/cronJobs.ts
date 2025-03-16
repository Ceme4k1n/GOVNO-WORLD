var cron = require('node-cron')
import { generate_news } from './controllers/newsController'
import { checkInactiveUsers } from './controllers/nftController'

cron.schedule('0 0 * * *', async () => {
  console.log('Запуск генерации новостей')
  await generate_news()
})

cron.schedule('0 12 * * *', async () => {
  console.log('Запуск рассылки о не заходе')
  await checkInactiveUsers()
})
