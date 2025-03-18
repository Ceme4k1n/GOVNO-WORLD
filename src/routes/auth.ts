import express from 'express'
import { validate_user, user_reg } from '../controllers/authControlles'

const router = express.Router()

router.post('/validate_user', validate_user)
router.post('/user_reg', user_reg)

export default router
