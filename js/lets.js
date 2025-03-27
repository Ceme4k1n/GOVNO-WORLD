// Функция для обновления CSS переменных
function updateFontSize() {
    const width = window.innerWidth;

    document.documentElement.style.setProperty('--font-small', '0.8vw');
    document.documentElement.style.setProperty('--font-normal', '1vw');
    document.documentElement.style.setProperty('--font-big', '1.5vw');
    document.documentElement.style.setProperty('--font-verybig', '2.3vw');

    if (width <= 1440) {
        document.documentElement.style.setProperty('--font-small', '1.2vw');
        document.documentElement.style.setProperty('--font-normal', '1.4vw');
        document.documentElement.style.setProperty('--font-big', '2.2vw');
        document.documentElement.style.setProperty('--font-verybig', '3vw');
    }

    if (width <= 1024) {
        document.documentElement.style.setProperty('--font-small', '1.6vw');
        document.documentElement.style.setProperty('--font-normal', '1.8vw');
        document.documentElement.style.setProperty('--font-big', '2.7vw');
        document.documentElement.style.setProperty('--font-verybig', '4vw');
    }

    if (width <= 768) {
        document.documentElement.style.setProperty('--font-small', '2.2vw');
        document.documentElement.style.setProperty('--font-normal', '2.5vw');
        document.documentElement.style.setProperty('--font-big', '4vw');
        document.documentElement.style.setProperty('--font-verybig', '5.5vw');
    }

    if (width <= 600) {
        document.documentElement.style.setProperty('--font-small', '3.2vw');
        document.documentElement.style.setProperty('--font-normal', '3.8vw');
        document.documentElement.style.setProperty('--font-big', '5.2vw');
        document.documentElement.style.setProperty('--font-verybig', '8vw');
    }

    if (width <= 480) {
        document.documentElement.style.setProperty('--font-small', '4vw');
        document.documentElement.style.setProperty('--font-normal', '4.8vw');
        document.documentElement.style.setProperty('--font-big', '6vw');
        document.documentElement.style.setProperty('--font-verybig', '9vw');
    }
}

// Инициализируем обновление переменных при загрузке страницы
updateFontSize();

// Обновляем переменные при изменении размера окна
window.addEventListener('resize', updateFontSize);
