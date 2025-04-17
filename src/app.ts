import express from 'express'
import { Server as SocketIOServer } from 'socket.io'

// Импортируем все остальные модули
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
import staking from './routes/staking'
import shop from './routes/shop'

import path from 'path'

const app = express()
const PORT = process.env.PORT || 4000

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
app.use('/staking', staking)
app.use('/shop', shop)

// Комментируем часть для HTTPS
/*
const SSL_CERT_PATH = '/web/serf/certificate.crt'
const SSL_KEY_PATH = '/web/serf/certificate.key'
const SSL_CA_PATH = '/web/serf/certificate_ca.crt'

const privateKey = fs.readFileSync(SSL_KEY_PATH, 'utf8')
const certificate = fs.readFileSync(SSL_CERT_PATH, 'utf8')
const ca = fs.readFileSync(SSL_CA_PATH, 'utf8')

const credentials = { key: privateKey, cert: certificate, ca: ca }

const httpsServer = https.createServer(credentials, app)
*/

// Используем HTTP сервер
const httpServer = app.listen(PORT, () => {
  console.log(`⚡ Server is running at http://localhost:${PORT}`)
})

// Инициализация Socket.IO с HTTP сервером
const io = new SocketIOServer(httpServer, {
  //Потом поменять на httpsServer
  cors: {
    origin: '*', // Разрешаем все домены, можно ограничить по необходимости
  },
})

// Обработчик подключения клиента через WebSocket
io.on('connection', (socket) => {
  console.log('✅ Новый WebSocket клиент подключился')

  socket.on('disconnect', () => {
    console.log('❌ Клиент отключился')
  })
})

// Экспортируем io для использования в других местах
export { io }
