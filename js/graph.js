const tg = window.Telegram.WebApp
const initDataUnsafe = tg.initDataUnsafe
const STORAGE_KEY = 'userProfileData'
const saveButton = document.querySelector('.profileChange-form-submit')

if (initDataUnsafe?.user?.first_name) {
  document.querySelector('.profile-user-title').textContent = initDataUnsafe?.user?.first_name
}

if (initDataUnsafe?.user?.photo_url) {
  document.querySelector('.profile-user-img').src = initDataUnsafe.user.photo_url
}

function validateNumber(value, min, max) {
  const num = Number(value)
  return !isNaN(num) && num >= min && num <= max
}

const userProfileData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
const userToiletVisits = userProfileData.profile_quantity ? parseInt(userProfileData.profile_quantity) : 1
const userDiet = userProfileData.profile_diet || 'omnivore'

const dietWeights = {
  balanced: 250,
  carnivore: 250,
  vegan: 300,
  omnivore: 270,
}
console.log(dietWeights[userDiet])

// Вычисляем вес за день, месяц, год
const weightPerVisit = dietWeights[userDiet] || 250 // Если вдруг нет в списке — берем 250
const dailyProduction = weightPerVisit * userToiletVisits // В граммах
const monthlyProduction = (dailyProduction * 30) / 1000 // В кг
const yearlyProduction = (dailyProduction * 365) / 1000 // В кг
const lifetimeProduction = (yearlyProduction * 75) / 1000 // В тоннах (при средней продолжительности жизни)

// Записываем в HTML
document.querySelector('.profile-statistics-box .profile-statistics-subbox:nth-child(1) span').textContent = `${dailyProduction} г`
document.querySelector('.profile-statistics-box .profile-statistics-subbox:nth-child(2) span').textContent = `${monthlyProduction.toFixed(1)} кг`
document.querySelector('.profile-statistics-box .profile-statistics-subbox:nth-child(3) span').textContent = `${lifetimeProduction.toFixed(1)} т`

document.addEventListener('DOMContentLoaded', async () => {
  const savedData = localStorage.getItem(STORAGE_KEY)

  if (savedData) {
    console.log('Данные загружены из LocalStorage')
    updateProfileUI(JSON.parse(savedData))
  } else {
    console.log('Данных в LocalStorage нет, загружаем с сервера...')
    await fetchUserData()
  }

  saveButton.addEventListener('click', async () => {
    const height = document.getElementById('profile-height-input').value
    const weight = document.getElementById('profile-weight-input').value
    const age = document.getElementById('profile-age-input').value
    const toiletVisits = document.getElementById('profile-quantity-input').value

    // Валидация полей
    if (!validateNumber(height, 80, 250)) {
      alert('Рост должен быть от 80 до 250 см.')
      return
    }
    if (!validateNumber(weight, 30, 300)) {
      alert('Вес должен быть от 30 до 300 кг.')
      return
    }
    if (!validateNumber(age, 5, 100)) {
      alert('Возраст должен быть от 5 до 100 лет.')
      return
    }
    if (!validateNumber(toiletVisits, 1, 10)) {
      alert('Количество походов в туалет должно быть от 1 до 10.')
      return
    }

    const updatedData = {
      user_age: age,
      user_height: height,
      user_weight: weight,
      user_sex: document.getElementById('profile-gender-select').value === 'male',
      user_eat: document.getElementById('profile-diet-select').value,
      user_toilet_visits: toiletVisits,
    }

    try {
      const response = await fetch('https://orchidshop.shop/profile/update_user_data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedData, initDataUnsafe }),
      })

      if (!response.ok) {
        throw new Error(`Ошибка сервера: ${response.status}`)
      }

      // Обновляем localStorage в правильном формате
      const localStorageData = {
        profile_age: updatedData.user_age,
        profile_weight: updatedData.user_weight,
        profile_gender: updatedData.user_sex ? 'male' : 'female',
        profile_height: updatedData.user_height,
        profile_quantity: updatedData.user_toilet_visits,
        profile_diet: updatedData.user_eat,
      }

      console.log('Данные успешно обновлены!')

      localStorage.setItem(STORAGE_KEY, JSON.stringify(localStorageData))
      updateProfileUI(localStorageData)
      console.log(localStorageData)

      document.getElementById('profile-edit-modal').style.display = 'none'
      document.body.classList.remove('modal-active')
    } catch (error) {
      console.error('Ошибка при обновлении данных:', error)
    }
  })
})

async function fetchUserData() {
  try {
    const response = await fetch('https://orchidshop.shop/profile/get_user_data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initDataUnsafe }),
    })

    if (!response.ok) {
      throw new Error(`Ошибка сервера: ${response.status}`)
    }

    const result = await response.json()

    if (result && result.result.length > 0) {
      const user = result.result[0]
      const data = {
        profile_age: user.user_age,
        profile_weight: user.user_weight,
        profile_gender: user.user_sex ? 'male' : 'female',
        profile_height: user.user_height,
        profile_quantity: user.user_toilet_visits,
        profile_diet: mapDiet(user.user_eat),
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      console.log('Данные сохранены в LocalStorage:', data)
      updateProfileUI(data)
    } else {
      console.log('Данные не найдены.')
    }
  } catch (error) {
    console.error('Ошибка получения данных профиля:', error)
  }
}

function mapDiet(eat) {
  switch (parseInt(eat, 10)) {
    case 0:
      return 'balanced'
    case 1:
      return 'carnivore'
    case 2:
      return 'vegan'
    case 3:
      return 'omnivore'
    default:
      return 'unknown'
  }
}

function updateProfileUI(data) {
  if (!data || typeof data !== 'object') {
    console.error('Ошибка: данные профиля отсутствуют или некорректны!', data)
    return
  }
  document.getElementById('profile-height-input').value = data.profile_height
  document.getElementById('profile-weight-input').value = data.profile_weight
  document.getElementById('profile-age-input').value = data.profile_age
  document.getElementById('profile-quantity-input').value = data.profile_quantity
  document.getElementById('profile-gender-select').value = data.profile_gender
  document.getElementById('profile-diet-select').value = data.profile_diet

  document.getElementById('profile-characteristics-height').innerText = `${data.profile_height} см.`
  document.getElementById('profile-characteristics-weight').innerText = `${data.profile_weight} кг.`
  document.getElementById('profile-characteristics-age').innerText = `${data.profile_age} лет`
  document.getElementById('profile-characteristics-gender').innerText = formatGender(data.profile_gender)
  document.getElementById('profile-characteristics-diet').innerText = formatDiet(data.profile_diet)
  document.getElementById('profile-characteristics-quantity').innerText = `${data.profile_quantity} раз(а)`
}

function formatGender(gender) {
  return gender === 'male' ? 'Мужчина' : 'Женщина'
}

function formatDiet(diet) {
  switch (diet) {
    case 'balanced':
      return 'Сбалансированный'
    case 'carnivore':
      return 'Мясоед'
    case 'vegan':
      return 'Веган'
    case 'omnivore':
      return 'Любитель фастфуда'
    default:
      return 'Не указан'
  }
}

// Логика открытия и закрытия модального окна
let profileChangeForm = document.getElementById('profileChange-form')
let ButtonOpen_profileChangeForm = document.getElementById('profile-edit-button')
let body = document.body

ButtonOpen_profileChangeForm.addEventListener('click', () => {
  profileChangeForm.classList.toggle('open')
  body.classList.add('modal-active')
})

document.addEventListener('click', function (event) {
  if (!profileChangeForm.contains(event.target) && !ButtonOpen_profileChangeForm.contains(event.target)) {
    profileChangeForm.classList.remove('open')
    body.classList.remove('modal-active')
  }
})

document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') {
    // Проверяем, нажат ли Esc
    if (profileChangeForm.classList.contains('open')) {
      // Проверяем, открыто ли модальное окно
      profileChangeForm.classList.remove('open')
      body.classList.remove('modal-active')
    }
  }
})

const rootStyles = getComputedStyle(document.documentElement)
const margin = {
  top: parseInt(rootStyles.getPropertyValue('--margin-top')),
  right: parseInt(rootStyles.getPropertyValue('--margin-right')),
  bottom: parseInt(rootStyles.getPropertyValue('--margin-bottom')),
  left: parseInt(rootStyles.getPropertyValue('--margin-left')),
}

const width = parseInt(rootStyles.getPropertyValue('--chart-width')) - margin.left - margin.right
const heightSvg = parseInt(rootStyles.getPropertyValue('--chart-height')) - margin.top - margin.bottom

const age = userProfileData.profile_age ? parseInt(userProfileData.profile_age) : 25
const lifeExpectancy = userProfileData.lifeExpectancy ? parseInt(userProfileData.lifeExpectancy) : 25
const toiletVisits = userProfileData.profile_quantity ? parseInt(userProfileData.profile_quantity) : 1

const diet = 'мясоед'

let averageWeight
switch (diet) {
  case 'мясоед':
    averageWeight = 250
    break
  case 'веган':
    averageWeight = 300
    break
  case 'фастфуд':
    averageWeight = 200
    break
  default:
    averageWeight = 250
}

const calculateData = (averageWeight, toiletVisits, age, lifeExpectancy) => {
  const dailyProduction = averageWeight * toiletVisits
  const weeklyProduction = dailyProduction * 7
  const monthlyProduction = dailyProduction * 30
  const yearlyProduction = dailyProduction * 365

  return [
    { time: 'день', amount: dailyProduction / 1000 },
    { time: 'неделя', amount: weeklyProduction / 1000 },
    { time: 'месяц', amount: monthlyProduction / 1000 },
    { time: 'год', amount: yearlyProduction / 1000 },
  ]
}

const chartData = calculateData(averageWeight, toiletVisits, age, lifeExpectancy)

const svg = d3
  .select('#chart')
  .append('svg')
  .attr('viewBox', `0 0 ${width + margin.left + margin.right} ${heightSvg + margin.top + margin.bottom}`)
  .attr('preserveAspectRatio', 'xMidYMid meet')
  .append('g')
  .attr('transform', `translate(${margin.left},${margin.top})`)

const x = d3
  .scalePoint()
  .domain(chartData.map((d) => d.time))
  .range([0, width])

const maxY = d3.max(chartData, (d) => d.amount) * 1.1

const y = d3.scaleLinear().domain([0, maxY]).range([heightSvg, 0])

const makeYGridlines = () => d3.axisLeft(y).ticks(5)

svg.append('g').attr('class', 'grid').call(makeYGridlines().tickSize(-width).tickFormat(''))

const xAxis = d3.axisBottom(x)
const yAxis = d3
  .axisLeft(y)
  .tickFormat((d) => `${d} кг`)
  .ticks(5)

svg.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${heightSvg})`).call(xAxis).selectAll('text').attr('class', 'axis-text')

svg.append('g').attr('class', 'y-axis').call(yAxis).selectAll('text').attr('class', 'axis-text')

const line = d3
  .line()
  .x((d) => x(d.time))
  .y((d) => y(d.amount))

svg.append('path').datum(chartData).attr('class', 'line').attr('d', line)
