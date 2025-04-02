import express from 'express'

import './cronJobs'
import db from './database/db'

import fs from 'fs'
import https from 'https'
import authRouter from './routes/auth'
import quizRouter from './routes/quiz'
import referralRouter from './routes/referral'
import newsRouter from './routes/news'
import profileRouter from './routes/profile'
import mapRouter from './routes/map'
import tournament from './routes/tournament'
import { generate_turn } from './controllers/tournamentController'

import path from 'path'

const app = express()
const PORT = process.env.PORT || '4000'

app.use(express.json())

app.use(express.static(path.join(__dirname, '../html')))
app.use('/js', express.static(path.join(__dirname, '../js')))
app.use('/scss', express.static(path.join(__dirname, '../scss')))
app.use('/css', express.static(path.join(__dirname, '../css')))
app.use('/img', express.static(path.join(__dirname, '../img')))

app.use('/auth', authRouter)
app.use('/quiz', quizRouter)
app.use('/referral', referralRouter)
app.use('/news', newsRouter)
app.use('/profile', profileRouter)
app.use('/map', mapRouter)
app.use('/turs', tournament)

// const SSL_CERT_PATH = '/web/serf/certificate.crt'
// const SSL_KEY_PATH = '/web/serf/certificate.key'
// const SSL_CA_PATH = '/web/serf/certificate_ca.crt'

// const privateKey = fs.readFileSync(SSL_KEY_PATH, 'utf8')
// const certificate = fs.readFileSync(SSL_CERT_PATH, 'utf8')
// const ca = fs.readFileSync(SSL_CA_PATH, 'utf8')

// const credentials = { key: privateKey, cert: certificate, ca: ca }

// https.createServer(credentials, app).listen(PORT, () => {
//   console.log(`Server is running on https://orchidshop.shop`)
// })

app.listen(PORT, () => {
  console.log(`⚡ Server is running at http://localhost:${PORT}`)
})
async function calculatePriceAndWinningFromDB(
  tournament_id: number, // ID турнира
  stakeYes: number,
  stakeNo: number,
  stakeYourBet: number,
  isBetOnYes: boolean // true = ставка на "Да", false = ставка на "Нет"
) {
  try {
    // Получаем текущие данные из БД
    const tournament = await db.oneOrNone(
      `
      SELECT total_bets_p1, total_bets_p2, price_p1, price_p2
      FROM govno_db.tournaments
      WHERE id = $1 AND status = 'active'
    `,
      [tournament_id]
    )

    if (!tournament) {
      throw new Error('Турнир не найден или уже завершён')
    }

    let priceFor
    let priceForWithSpread

    // Устанавливаем цену за голос в зависимости от того, на какую ставку игрок делает
    if (isBetOnYes) {
      priceFor = tournament.price_p1
    } else {
      priceFor = tournament.price_p2
    }

    // Если ставки равны нулю (на старте турнира)
    if (stakeYes === 0 && stakeNo === 0) {
      console.log('🔹 На старте турнира. Устанавливаем начальные значения.')
      priceFor = 0.5 // Базовая цена для начала
      priceForWithSpread = 0.5 // Цена с учётом спреда на старте
    } else {
      // Рассчитываем разницу в процентах между ставками
      const totalStake = stakeYes + stakeNo
      const percentageFor = (stakeYes / totalStake) * 100
      const percentageAgainst = (stakeNo / totalStake) * 100

      let spread = 1 + Math.abs(percentageFor - percentageAgainst) / 2 / 10

      // Ограничиваем спред в пределах 1% и 3%
      if (spread > 3) spread = 3
      else if (spread < 1) spread = 1

      const spreadToMoreProb = (1 / 3) * spread

      // Цена за голос с учётом спреда
      priceForWithSpread = priceFor + spreadToMoreProb / 100
    }

    // Рассчитываем количество голосов, которые можно купить на выбранную ставку
    const yourVotes = stakeYourBet / priceForWithSpread

    // Рассчитываем общий пул на выбранную ставку
    const totalForPool = isBetOnYes ? stakeYes + stakeYourBet : stakeNo + stakeYourBet

    // Общий пул
    const totalPool = stakeYes + stakeNo + stakeYourBet

    // Рассчитываем твою долю в общем пуле
    const yourShare = yourVotes / totalPool

    // Рассчитываем твой выигрыш, если выбранная сторона выигрывает
    const winningAmount = totalPool * yourShare

    // Логирование результатов
    console.log('📊 Итоги расчёта до ставки:')
    console.log(`🔹 Ставка сделана на: ${isBetOnYes ? '✅ Да' : '❌ Нет'}`)
    console.log(`🔹 Базовая цена за голос: ${priceFor.toFixed(4)}$`)
    console.log(`🔹 Итоговая цена (с учётом спреда): ${priceForWithSpread.toFixed(4)}$`)
    //console.log(`🔹 Спред: ${spread.toFixed(2)}%`)
    console.log(`🔹 Количество купленных голосов: ${yourVotes.toFixed(2)}`)
    console.log(`🔹 Общий пул после ставки: ${totalPool}$`)
    console.log(`🔹 Ваша доля в общем пуле: ${(yourShare * 100).toFixed(2)}%`)
    console.log(`🏆 Потенциальный выигрыш: ${winningAmount.toFixed(2)}$`)
    console.log('✅ Расчёт завершён!\n')

    return {
      priceFor: priceFor,
      priceForWithSpread: priceForWithSpread,
      yourVotes: yourVotes.toFixed(2),
      yourShare: (yourShare * 100).toFixed(2),
      winningAmount: winningAmount.toFixed(2),
    }
  } catch (error) {
    console.error('❌ Ошибка при расчёте:', error)
    throw error
  }
}

// function calculatePriceAndWinning(
//   stakeYes: number,
//   stakeNo: number,
//   stakeYourBet: number,
//   isBetOnYes: boolean // true = ставка на "Да", false = ставка на "Нет"
// ) {
//   if (stakeYes === 0 && stakeNo === 0) {
//     console.log('🔹 На старте турнира. Устанавливаем начальные значения.')
//     return {
//       percentageYes: 50.0,
//       percentageNo: 50.0,
//       priceYes: 0.5,
//       priceYesWithSpread: 0.5,
//       spread: 0, // Нет спреда на старте
//       yourVotes: (stakeYourBet / 0.5).toFixed(2),
//       yourShare: (50.0).toFixed(2), // 50% доля
//       winningAmount: (stakeYourBet * 2).toFixed(2), // Выигрыш в два раза больше, т.к. 50% шанс
//     }
//   }
//   // Определяем, на кого сделана ставка
//   const stakeFor = isBetOnYes ? stakeYes : stakeNo
//   const stakeAgainst = isBetOnYes ? stakeNo : stakeYes

//   // Общая сумма ставок
//   const totalStake = stakeYes + stakeNo

//   // Рассчитываем процент для каждой ставки
//   const percentageFor = (stakeFor / totalStake) * 100
//   const percentageAgainst = (stakeAgainst / totalStake) * 100

//   // Цена (вероятность) для выбранной ставки
//   const priceFor = stakeFor / totalStake

//   // Рассчитываем разницу в процентах между ставками
//   const percentageDifference = Math.abs(percentageFor - percentageAgainst)

//   let spread = 1 + percentageDifference / 2 / 10

//   // Ограничиваем спред в пределах 1% и 3%
//   if (spread > 3) spread = 3
//   else if (spread < 1) spread = 1

//   // Рассчитываем, сколько спреда добавить к цене
//   const spreadToMoreProb = (1 / 3) * spread

//   // Добавляем спред к цене
//   const priceForWithSpread = priceFor + spreadToMoreProb / 100

//   // Рассчитываем количество голосов, которые можно купить на выбранную ставку
//   const yourVotes = stakeYourBet / priceForWithSpread

//   // Рассчитываем общий пул на выбранную ставку
//   const totalForPool = stakeFor + stakeYourBet

//   // Общий пул
//   const totalPool = totalStake + stakeYourBet

//   // Рассчитываем твою долю в общем пуле
//   const yourShare = yourVotes / totalPool

//   // Рассчитываем твой выигрыш, если выбранная сторона выигрывает
//   const winningAmount = totalPool * yourShare

//   // ЛОГИ ПОСЛЕ ВЫПОЛНЕНИЯ
//   console.log('📊 Итоги расчёта после ставки:')
//   console.log(`🔹 Ставка сделана на: ${isBetOnYes ? '✅ Да' : '❌ Нет'}`)
//   console.log(`🔹 Процент ставок:`)
//   console.log(`   ✅ "Да": ${percentageFor.toFixed(2)}%`)
//   console.log(`   ❌ "Нет": ${percentageAgainst.toFixed(2)}%`)
//   console.log(`🔹 Базовая цена: ${priceFor.toFixed(4)}$`)
//   console.log(`🔹 Итоговая цена (со спредом): ${priceForWithSpread.toFixed(4)}$`)
//   console.log(`🔹 Спред: ${spread.toFixed(2)}%`)
//   console.log(`🔹 Количество купленных голосов: ${yourVotes.toFixed(2)}`)
//   console.log(`🔹 Общий пул после ставки: ${totalPool}$`)
//   console.log(`🔹 Ваша доля в общем пуле: ${(yourShare * 100).toFixed(2)}%`)
//   console.log(`🏆 Потенциальный выигрыш: ${winningAmount.toFixed(2)}$`)
//   console.log('✅ Расчёт завершён!\n')

//   return {
//     percentageFor: parseFloat(percentageFor.toFixed(2)),
//     percentageAgainst: parseFloat(percentageAgainst.toFixed(2)),
//     priceFor: parseFloat(priceFor.toFixed(2)),
//     priceForWithSpread: parseFloat(priceForWithSpread.toFixed(2)),
//     spread,
//     yourVotes: yourVotes.toFixed(2),
//     yourShare: (yourShare * 100).toFixed(2),
//     winningAmount: winningAmount.toFixed(2),
//   }
// }
function calculatePricesForYesAndNo(stakeYes: number, stakeNo: number) {
  // Общая сумма ставок
  const totalStake = stakeYes + stakeNo

  // Цена для ставки на "Да" (без спреда)
  const priceYes = stakeYes / totalStake
  // Цена для ставки на "Нет" (без спреда)
  const priceNo = stakeNo / totalStake

  // Рассчитываем разницу в процентах между ставками для "Да" и "Нет"
  const percentageFor = (stakeYes / totalStake) * 100
  const percentageAgainst = (stakeNo / totalStake) * 100
  const percentageDifference = Math.abs(percentageFor - percentageAgainst)

  // Рассчитываем спред
  let spread = 1 + percentageDifference / 2 / 10

  // Ограничиваем спред в пределах 1% и 3%
  if (spread > 3) spread = 3
  else if (spread < 1) spread = 1

  // Рассчитываем, как распределить спред
  const spreadForLessProb = (2 / 3) * spread // Спред для менее вероятного исхода
  const spreadForMoreProb = (1 / 3) * spread // Спред для более вероятного исхода

  // Для ставки на "Да" (более вероятный исход, если stakeYes больше)
  const priceYesWithSpread = priceYes + (stakeYes > stakeNo ? spreadForMoreProb : spreadForLessProb) / 100

  // Для ставки на "Нет" (менее вероятный исход, если stakeNo больше)
  const priceNoWithSpread = priceNo + (stakeYes > stakeNo ? spreadForLessProb : spreadForMoreProb) / 100

  // Логирование результатов
  console.log('📊 Итоги расчёта цены для ставок на "Да" и "Нет":')
  console.log(`🔹 Цена для "Да" (без спреда): ${priceYes.toFixed(2)}$`)
  console.log(`🔹 Цена для "Да" (с учётом спреда): ${priceYesWithSpread.toFixed(2)}$`)
  console.log(`🔹 Спред для "Да": ${spread.toFixed(2)}%`)
  console.log(`🔹 Цена для "Нет" (без спреда): ${priceNo.toFixed(2)}$`)
  console.log(`🔹 Цена для "Нет" (с учётом спреда): ${priceNoWithSpread.toFixed(2)}$`)
  console.log(`🔹 Спред для "Нет": ${spread.toFixed(2)}%`)
  console.log('✅ Расчёт завершён!\n')

  // Возвращаем цены и спреды для "Да" и "Нет"
  return {
    priceYes: priceYes.toFixed(4),
    priceYesWithSpread: priceYesWithSpread.toFixed(4),
    priceNo: priceNo.toFixed(4),
    priceNoWithSpread: priceNoWithSpread.toFixed(4),
    spreadYes: spread.toFixed(2),
    spreadNo: spread.toFixed(2),
  }
}

async function placeBet(user_id: number, tournament_id: number, bet_bool: boolean, amount: number) {
  try {
    // Получаем данные о турнире
    const tournament = await db.oneOrNone(`SELECT total_bets_p1, total_bets_p2, price_p1, price_p2 FROM govno_db.tournaments WHERE id = $1 AND status = 'active'`, [tournament_id])

    console.log('Турнирные данные:', tournament)

    if (!tournament) {
      console.log('❌ Турнир не найден или уже завершен')
      throw new Error('Турнир не найден или уже завершен')
    }

    const bets = await calculatePriceAndWinningFromDB(1, tournament.total_bets_p1, tournament.total_bets_p2, amount, bet_bool)

    // Проверяем, если ставки ещё не сделаны (первая ставка)
    let new_price
    if (tournament.total_bets_p1 === 0 && tournament.total_bets_p2 === 0) {
      // Для первой ставки устанавливаем фиксированные начальные цены и спреды
      new_price = {
        priceYes: 0.5, // Начальная цена для "Да"
        priceNo: 0.5, // Начальная цена для "Нет"
        priceYesWithSpread: 0.5, // Цена для "Да" с учётом спреда
        priceNoWithSpread: 0.5, // Цена для "Нет" с учётом спреда
        spreadYes: 0, // Спред для "Да" (0 для первой ставки)
        spreadNo: 0, // Спред для "Нет" (0 для первой ставки)
      }
    } else {
      // Для последующих ставок, рассчитываем цены и спреды
      new_price = calculatePricesForYesAndNo(tournament.total_bets_p1, tournament.total_bets_p2)
    }

    // Рассчитываем и обновляем ставки и цены для турнира
    if (bet_bool) {
      await db.none(`UPDATE govno_db.tournaments SET price_p1 = $1, price_p2 = $2, price_p1_spread = $3, price_p2_spread = $4, total_bets_p1 = $5`, [new_price.priceYes, new_price.priceNo, new_price.priceYesWithSpread, new_price.priceNoWithSpread, tournament.total_bets_p1 + amount])
    } else {
      await db.none(`UPDATE govno_db.tournaments SET price_p1 = $1, price_p2 = $2, price_p1_spread = $3, price_p2_spread = $4, total_bets_p2 = $5`, [new_price.priceYes, new_price.priceNo, new_price.priceYesWithSpread, new_price.priceNoWithSpread, tournament.total_bets_p2 + amount])
    }

    console.log('✅ Ставка успешно обновлена')
  } catch (error) {
    console.error('❌ Ошибка в `placeBet`:', error)
  }
}

// Тестовый вызов
placeBet(1, 1, false, 50)

// async function placeBet(userId: number, tournamentId: number, playerBet: 'P1' | 'P2', amount: number) {
//   try {
//     // Получаем данные о турнире
//     const tournament = await db.oneOrNone(
//       `
//       SELECT total_bets_p1, total_bets_p2, price_p1, price_p2, spread
//       FROM govno_db.tournaments
//       WHERE id = $1 AND status = 'active'
//       FOR UPDATE;
//     `,
//       [tournamentId]
//     )

//     if (!tournament) {
//       throw new Error('Турнир не найден или уже завершен')
//     }

//     let { total_bets_p1, total_bets_p2, price_p1, price_p2, spread } = tournament

//     // Определяем, на кого сделана ставка
//     const isBetOnP1 = playerBet === 'P1'
//     const stakeYes = isBetOnP1 ? total_bets_p1 : total_bets_p2
//     const stakeNo = isBetOnP1 ? total_bets_p2 : total_bets_p1

//     // Вызываем функцию расчета
//     const results = calculatePriceAndWinningForYes(stakeYes, stakeNo, amount)

//     const priceYes = isBetOnP1 ? price_p1 : price_p2
//     const priceYesWithSpread = results.priceYesWithSpread
//     const potentialWin = results.winningAmount

//     // Логирование данных
//     console.log(`✅ Ставка на ${playerBet}`)
//     console.log(`🔹 Ставка: ${amount}$`)
//     console.log(`🔹 Цена без спреда: $${priceYes}`)
//     console.log(`🔹 Цена со спредом: $${priceYesWithSpread}`)
//     console.log(`🔹 Спред: ${results.spread}%`)
//     console.log(`🔹 Количество голосов куплено: ${results.yourVotes}`)
//     console.log(`🔹 Потенциальный выигрыш: ${potentialWin}$`)

//     // Обновляем данные в tournaments
//     await db.none(
//       `
//       UPDATE govno_db.tournaments
//       SET
//         total_bets_p1 = total_bets_p1 + $1,
//         total_bets_p2 = total_bets_p2 + $2,
//         price_p1 = $3,
//         price_p2 = $4,
//         spread = $5
//       WHERE id = $6;
//       `,
//       [
//         isBetOnP1 ? amount : 0, // Добавляем сумму к total_bets_p1, если ставка на P1
//         isBetOnP1 ? 0 : amount, // Добавляем сумму к total_bets_p2, если ставка на P2
//         isBetOnP1 ? priceYesWithSpread : price_p1,
//         isBetOnP1 ? price_p2 : priceYesWithSpread,
//         results.spread,
//         tournamentId,
//       ]
//     )

//     // Записываем ставку в bets
//     await db.none(
//       `
//       INSERT INTO govno_db.bets (user_id, tournament_id, player_bet, amount, price_without_spread, price_with_spread, potential_win)
//       VALUES ($1, $2, $3, $4, $5, $6, $7);
//       `,
//       [userId, tournamentId, playerBet, amount, priceYes, priceYesWithSpread, potentialWin]
//     )

//     console.log(`✅ Ставка ${amount}$ на ${playerBet} успешно сделана!`)
//   } catch (error) {
//     console.error('❌ Ошибка при размещении ставки:', error)
//   }
// }
