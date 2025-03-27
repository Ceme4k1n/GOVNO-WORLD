document.body.innerHTML += `
    <nav class="navbar">
        <a href="./index.html" class="navbar-title">$GOVNO</a>
        <button class="navbar-buttonOpenMenu"><img class="navbar-buttonOpenMenu-img" src="/img/1.svg" alt=""></button>
    </nav>

    <div class="menu-modal">
        <div class="menu-content">
            <div class="menu-avatar">
                <h2>Govnochist777</h2>
                <img src="/img/qwe.jpg" alt="">
            </div>
            <div class="menu-navbar">
                <a href="./profile.html"><img src="/img/profile-icon.svg" alt="">Мой профиль<img class="menu-navbar-arrow" src="/img/menu-arrow.svg" alt=""></a>
                <a href="./referrals.html"><img src="/img/referrals-icon.svg" alt="">Рефералы<img class="menu-navbar-arrow" src="/img/menu-arrow.svg" alt=""></a>
            </div>
            <div class="menu-navbar">
                <a href=""><img src="/img/rates-icon.svg" alt=""> Говно-ставки</a>
                <a href="./maps.html"><img src="/img/map-icon.svg" alt="">Говно-карта</a>
                <a href=""><img src="/img/graph-icon.svg" alt="">Говно-график</a>
                <a href="./news.html"><img src="/img/news-icon.svg" alt="">Говно-новости</a>
                <a href=""><img src="/img/achievements-icon.svg" alt="">Говно-достижения</a>
                <a href=""><img src="/img/partners-icon.svg" alt="">Говно-партнеры</a>
                <a href="./survey.html"><img src="/img/survey-icon.svg" alt="">Говно-опрос</a>
                <a href=""><img src="/img/tasks-icon.svg" alt="">Говно-задания</a>
            </div>
        </div>
    </div>`

// Теперь находим элемент меню и кнопку
let menu = document.querySelector('.menu-modal')
let openMenuButton = document.querySelector('.navbar-buttonOpenMenu')

openMenuButton.addEventListener('click', () => {
  menu.classList.toggle('open')
})

document.addEventListener('click', function (event) {
  if (!menu.contains(event.target) && !openMenuButton.contains(event.target)) {
    menu.classList.remove('open')
  }
})

document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') {
    if (menu.classList.contains('open')) {
      menu.classList.remove('open')
    }
  }
})
