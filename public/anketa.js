window.selectGender = function (gender) {
  const maleButton = document.querySelector('.male')
  const femaleButton = document.querySelector('.female')

  if (gender === 'male') {
    maleButton.classList.add('active')
    femaleButton.classList.remove('active')
  } else {
    femaleButton.classList.add('active')
    maleButton.classList.remove('active')
  }

  selectedGender = gender
  window.checkForm()
}

window.checkForm = function () {
  const weight = document.getElementById('weight').value
  const age = document.getElementById('age').value
  const height = document.getElementById('height').value
  const toiletVisits = document.getElementById('toilet_visits').value
  const submitBtn = document.getElementById('submitBtn')

  if (weight > 0 && weight <= 300 && age > 0 && age <= 200 && height > 0 && height <= 500 && toiletVisits > 0 && toiletVisits <= 20 && selectedGender) {
    submitBtn.disabled = false
  } else {
    submitBtn.disabled = true
  }
}

// ✅ Вот так делаем submitForm глобальным
window.submitForm = function () {
  //const initDataUnsafe = window.Telegram.WebApp.initDataUnsafe
  const weight = document.getElementById('weight').value
  const age = document.getElementById('age').value
  const height = document.getElementById('height').value
  const toiletVisits = document.getElementById('toilet_visits').value

  console.log('Анкета отправлена:')
  console.log('Вес:', weight)
  console.log('Возраст:', age)
  console.log('Рост:', height)
  console.log('Походы в туалет:', toiletVisits)
  console.log('Пол:', selectedGender)

  // 👉 Тут будет отправка формы на сервер
  fetch('http://localhost:443/auth/user_reg', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ weight, age, height, toilet_visits: toiletVisits, gender: selectedGender }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        alert('Анкета успешно отправлена! 💩')
        window.location.href = 'indez.html'
      } else {
        alert('Ошибка при отправке анкеты 😢')
      }
    })
    .catch((err) => {
      console.error('Ошибка:', err)
      alert('Ошибка при отправке анкеты 😢')
    })
}
