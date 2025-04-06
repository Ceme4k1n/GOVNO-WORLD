module.exports = {
  apps: [
    {
      name: 'my-app',
      script: './dist/app.js', // Путь к скомпилированному .js файлу
      instances: 4, // Запуск 4 процессов
      exec_mode: 'cluster', // Режим кластеризации
      watch: false, // Включение отслеживания изменений
      log_file: 'logs/my-app.log',
      out_file: 'logs/my-app-out.log',
      error_file: 'logs/my-app-error.log',
      combine_logs: true, // Объединение логов
    },
  ],
}
