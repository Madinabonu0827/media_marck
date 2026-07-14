import { Router } from 'express'
import { optionalAuth } from '../middleware/auth'
import Entry from '../models/Entry'

const router = Router()

router.get('/', optionalAuth, async (_req, res) => {
  try {
    const topReaders = await Entry.aggregate([
      { $lookup: { from: 'mediaitems', localField: 'mediaId', foreignField: '_id', as: 'media' } },
      { $unwind: '$media' },
      { $match: { 'media.type': 'book', status: 'completed' } },
      { $group: { _id: '$userId', count: { $sum: 1 }, avgRating: { $avg: '$rating' } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { _id: 1, count: 1, avgRating: { $round: ['$avgRating', 1] }, 'user.username': 1, 'user.avatarUrl': 1 } },
    ])
    const topReviewers = await Entry.aggregate([
      { $match: { review: { $ne: '' } } },
      { $group: { _id: '$userId', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { _id: 1, count: 1, 'user.username': 1, 'user.avatarUrl': 1 } },
    ])
    const topRated = await Entry.aggregate([
      { $match: { rating: { $gt: 0 } } },
      { $group: { _id: '$userId', avgRating: { $avg: '$rating' }, totalEntries: { $sum: 1 } } },
      { $match: { totalEntries: { $gte: 3 } } },
      { $sort: { avgRating: -1 } },
      { $limit: 10 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } },
      { $unwind: '$user' },
      { $project: { _id: 1, avgRating: { $round: ['$avgRating', 1] }, totalEntries: 1, 'user.username': 1, 'user.avatarUrl': 1 } },
    ])
    res.json({ success: true, data: { topReaders, topReviewers, topRated } })
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

export default router
