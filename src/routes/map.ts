import express from 'express'
import { update_shit } from '../controllers/mapController'

const router = express.Router()

router.post('/update_shit', update_shit)

export default router
