import express from 'express'
import { get_all_skins, purchase_skin } from '../controllers/shopController'

const router = express.Router()

router.get('/get_skins', get_all_skins)
router.post('/purchase_skin', purchase_skin)

export default router
