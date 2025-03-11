import express from 'express'
import { validate_user } from '../controllers/authControlles'

const router = express.Router()

router.post('/validate_user', validate_user)

export default router
