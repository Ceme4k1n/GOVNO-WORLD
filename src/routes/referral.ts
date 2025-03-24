import express from 'express'
import { get_referrals } from '../controllers/referralController'

const router = express.Router()

router.post('/get_ref', get_referrals)

export default router
