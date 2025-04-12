var cron = require('node-cron')
import { generate_news } from './controllers/newsController'
import { checkInactiveUsers } from './controllers/nftController'
import { end_cites_and_countries_tours } from './controllers/tournamentController'
import { check_stakes_to_burn } from './controllers/stakingController'

cron.schedule('0 0 * * *', async () => {
  console.log('Запуск генерации новостей')
  await generate_news()
  console.log('Запуск проверки окончания турниров по странам и городам')

  end_cites_and_countries_tours()
})

cron.schedule('0 12 * * *', async () => {
  console.log('Запуск рассылки о не заходе')
  await checkInactiveUsers()
})

cron.schedule('24 20 * * *', async () => {
  // console.log('Запуск генерации новостей')
  // await generate_news()
  console.log('Запуск проверки окончания турниров по странам и городам')
  end_cites_and_countries_tours()
})

// cron.schedule('* * * * *', async () => {
//   console.log('Я запустился')
//   check_stakes_to_burn()
// })
