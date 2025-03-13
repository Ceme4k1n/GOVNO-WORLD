import express from 'express'
import fs from 'fs'
import https from 'https'
import authRouter from './routes/auth'
import quizRouter from './routes/quiz'
import path from 'path'

const app = express()
const PORT = process.env.PORT || '4000'

app.use(express.json())

app.use(express.static(path.join(__dirname, '../public')))
app.use('/scss', express.static(path.join(__dirname, '../scss')))
app.use('/css', express.static(path.join(__dirname, '../css')))
<<<<<<< HEAD
app.use('/img', express.static(path.join(__dirname, '../img')))


=======
>>>>>>> 04dd37937e53298f42755f8341ed8b049df0983f

app.use('/auth', authRouter)
app.use('/quiz', quizRouter)
/*
const SSL_CERT_PATH = '/web/serf/certificate.crt'
const SSL_KEY_PATH = '/web/serf/certificate.key'
const SSL_CA_PATH = '/web/serf/certificate_ca.crt'

// Читаем сертификаты
const privateKey = fs.readFileSync(SSL_KEY_PATH, 'utf8')
const certificate = fs.readFileSync(SSL_CERT_PATH, 'utf8')
const ca = fs.readFileSync(SSL_CA_PATH, 'utf8')

const credentials = { key: privateKey, cert: certificate, ca: ca }

https.createServer(credentials, app).listen(PORT, () => {
  console.log(`Server is running on https://orchidshop.shop`)
})
*/
 app.listen(PORT, () => {
   console.log(`⚡ Server is running at http://localhost:${PORT}`)
 })
