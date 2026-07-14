import { Router } from 'express'
import auth, { AuthRequest } from '../middleware/auth'
import Notification from '../models/Notification'

const router = Router()

router.get('/', auth, async (req: AuthRequest, res) => {
  try {
    const { page = '1', limit = '20' } = req.query
    const pageNum = parseInt(page as string, 10)
    const limitNum = parseInt(limit as string, 10)
    const skip = (pageNum - 1) * limitNum
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find({ userId: req.user!.id }).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Notification.countDocuments({ userId: req.user!.id }),
      Notification.countDocuments({ userId: req.user!.id, isRead: false }),
    ])
    res.json({ success: true, data: { notifications, unreadCount, total, page: pageNum, pages: Math.ceil(total / limitNum) } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.patch('/:id/read', auth, async (req: AuthRequest, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { isRead: true },
      { new: true }
    )
    if (!notification) {
      res.status(404).json({ success: false, message: 'Notification not found' })
      return
    }
    res.json({ success: true, data: { notification } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.patch('/read-all', auth, async (req: AuthRequest, res) => {
  try {
    await Notification.updateMany({ userId: req.user!.id, isRead: false }, { isRead: true })
    res.json({ success: true, message: 'All notifications marked as read' })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

export default router
