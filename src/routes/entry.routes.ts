import { Router, Response } from 'express'
import { body, validationResult } from 'express-validator'
import auth, { AuthRequest, optionalAuth } from '../middleware/auth'
import Entry from '../models/Entry'
import MediaItem from '../models/MediaItem'
import User from '../models/User'
import Notification from '../models/Notification'

const router = Router()

router.post(
  '/',
  auth,
  [
    body('mediaId').notEmpty().withMessage('Media ID is required'),
    body('status').isIn(['planned', 'in_progress', 'completed', 'dropped']).withMessage('Invalid status'),
  ],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, message: errors.array()[0].msg })
        return
      }
      const { mediaId, status, rating, review, progress, isSpoiler } = req.body
      const media = await MediaItem.findById(mediaId)
      if (!media) {
        res.status(404).json({ success: false, message: 'Media not found' })
        return
      }
      const existingEntry = await Entry.findOne({ userId: req.user!.id, mediaId })
      if (existingEntry) {
        res.status(400).json({ success: false, message: 'You already have an entry for this media' })
        return
      }
      const entry = new Entry({
        userId: req.user!.id, mediaId, status, rating: rating || 0,
        review: review || '', progress: progress || '', isSpoiler: isSpoiler || false,
        startDate: status === 'in_progress' ? new Date() : undefined,
        endDate: status === 'completed' ? new Date() : undefined,
      })
      await entry.save()
      const populatedEntry = await Entry.findById(entry._id)
        .populate('userId', 'username avatarUrl')
        .populate('mediaId', 'title type coverUrl')
      res.status(201).json({ success: true, data: { entry: populatedEntry } })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  }
)

router.get('/media/:mediaId', optionalAuth, async (req, res) => {
  try {
    const { page = '1', limit = '50' } = req.query
    const filter: any = { mediaId: req.params.mediaId }
    const pageNum = parseInt(page as string, 10)
    const limitNum = parseInt(limit as string, 10)
    const skip = (pageNum - 1) * limitNum
    const [entries, total] = await Promise.all([
      Entry.find(filter)
        .populate('userId', 'username avatarUrl')
        .populate('mediaId', 'title type coverUrl')
        .sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Entry.countDocuments(filter),
    ])
    res.json({ success: true, data: { entries, total, page: pageNum, pages: Math.ceil(total / limitNum) } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/user/:userId', optionalAuth, async (req, res) => {
  try {
    const { status, type, page = '1', limit = '20' } = req.query
    const filter: any = { userId: req.params.userId }
    if (status) filter.status = status
    const pageNum = parseInt(page as string, 10)
    const limitNum = parseInt(limit as string, 10)
    const skip = (pageNum - 1) * limitNum
    const [entries, total] = await Promise.all([
      Entry.find(filter)
        .populate('userId', 'username avatarUrl')
        .populate('mediaId', 'title type coverUrl')
        .sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Entry.countDocuments(filter),
    ])
    let filteredEntries = entries
    if (type) {
      filteredEntries = entries.filter((entry: any) => entry.mediaId && entry.mediaId.type === type)
    }
    res.json({ success: true, data: { entries: filteredEntries, total, page: pageNum, pages: Math.ceil(total / limitNum) } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/feed', auth, async (req: AuthRequest, res) => {
  try {
    const { page = '1', limit = '20' } = req.query
    const currentUser = await User.findById(req.user!.id)
    if (!currentUser) {
      res.status(404).json({ success: false, message: 'User not found' })
      return
    }
    const followingIds = currentUser.following
    const pageNum = parseInt(page as string, 10)
    const limitNum = parseInt(limit as string, 10)
    const skip = (pageNum - 1) * limitNum
    const filter: any = { userId: { $in: followingIds } }
    const [entries, total] = await Promise.all([
      Entry.find(filter)
        .populate('userId', 'username avatarUrl')
        .populate('mediaId', 'title type coverUrl')
        .sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Entry.countDocuments(filter),
    ])
    res.json({ success: true, data: { entries, total, page: pageNum, pages: Math.ceil(total / limitNum) } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.patch('/:id', auth, async (req: AuthRequest, res) => {
  try {
    const entry = await Entry.findById(req.params.id)
    if (!entry) {
      res.status(404).json({ success: false, message: 'Entry not found' })
      return
    }
    if (entry.userId.toString() !== req.user!.id) {
      res.status(403).json({ success: false, message: 'Not authorized' })
      return
    }
    const { status, rating, review, progress, isSpoiler } = req.body
    if (status !== undefined) {
      entry.status = status
      if (status === 'in_progress' && !entry.startDate) entry.startDate = new Date()
      if (status === 'completed') {
        entry.endDate = new Date()
        if (!entry.startDate) entry.startDate = new Date()
      }
    }
    if (rating !== undefined) entry.rating = rating
    if (review !== undefined) entry.review = review
    if (progress !== undefined) entry.progress = progress
    if (isSpoiler !== undefined) entry.isSpoiler = isSpoiler
    await entry.save()
    const populatedEntry = await Entry.findById(entry._id)
      .populate('userId', 'username avatarUrl')
      .populate('mediaId', 'title type coverUrl')
    res.json({ success: true, data: { entry: populatedEntry } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.delete('/:id', auth, async (req: AuthRequest, res) => {
  try {
    const entry = await Entry.findById(req.params.id)
    if (!entry) {
      res.status(404).json({ success: false, message: 'Entry not found' })
      return
    }
    if (entry.userId.toString() !== req.user!.id) {
      res.status(403).json({ success: false, message: 'Not authorized' })
      return
    }
    await Entry.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Entry deleted' })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/:id/like', auth, async (req: AuthRequest, res) => {
  try {
    const entry = await Entry.findById(req.params.id)
    if (!entry) {
      res.status(404).json({ success: false, message: 'Entry not found' })
      return
    }
    const userId = req.user!.id
    const isLiked = entry.likes.includes(userId as any)
    if (isLiked) {
      entry.likes = entry.likes.filter((id) => id.toString() !== userId)
    } else {
      entry.likes.push(userId as any)
      if (entry.userId.toString() !== userId) {
        const liker = await User.findById(userId)
        await Notification.create({
          userId: entry.userId, type: 'like',
          text: `${liker?.username || 'Someone'} liked your entry`,
          link: `/entry/${entry._id}`,
        })
      }
    }
    await entry.save()
    res.json({ success: true, data: { isLiked: !isLiked, likesCount: entry.likes.length } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post(
  '/:id/comment',
  auth,
  [body('text').notEmpty().withMessage('Comment text is required')],
  async (req: AuthRequest, res: Response) => {
    try {
      const errors = validationResult(req)
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, message: errors.array()[0].msg })
        return
      }
      const entry = await Entry.findById(req.params.id)
      if (!entry) {
        res.status(404).json({ success: false, message: 'Entry not found' })
        return
      }
      entry.comments.push({ userId: req.user!.id as any, text: req.body.text, createdAt: new Date() })
      await entry.save()
      if (entry.userId.toString() !== req.user!.id) {
        const commenter = await User.findById(req.user!.id)
        await Notification.create({
          userId: entry.userId, type: 'comment',
          text: `${commenter?.username || 'Someone'} commented on your entry`,
          link: `/entry/${entry._id}`,
        })
      }
      const populatedEntry = await Entry.findById(entry._id)
        .populate('userId', 'username avatarUrl')
        .populate('mediaId', 'title type coverUrl')
        .populate('comments.userId', 'username avatarUrl')
      res.json({ success: true, data: { entry: populatedEntry } })
    } catch (error) {
      res.status(500).json({ success: false, message: 'Server error' })
    }
  }
)

export default router
