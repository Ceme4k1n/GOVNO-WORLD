import express from 'express'
import { get_data, update_user_data } from '../controllers/profileConstroller'

const router = express.Router()

router.post('/get_user_data', get_data)
router.post('/update_user_data', update_user_data)

export default router
