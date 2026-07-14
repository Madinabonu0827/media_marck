import mongoose, { Schema, Document } from 'mongoose'

export interface IComment {
  userId: mongoose.Types.ObjectId
  text: string
  createdAt: Date
}

export interface IEntry extends Document {
  userId: mongoose.Types.ObjectId
  mediaId: mongoose.Types.ObjectId
  status: 'planned' | 'in_progress' | 'completed' | 'dropped'
  rating: number
  review: string
  progress: string
  startDate?: Date
  endDate?: Date
  isSpoiler: boolean
  likes: mongoose.Types.ObjectId[]
  comments: IComment[]
}

const commentSchema = new Schema<IComment>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, maxlength: 1000 },
}, { timestamps: true })

const entrySchema = new Schema<IEntry>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  mediaId: { type: Schema.Types.ObjectId, ref: 'MediaItem', required: true },
  status: { type: String, enum: ['planned', 'in_progress', 'completed', 'dropped'], default: 'planned' },
  rating: { type: Number, min: 0, max: 10, default: 0 },
  review: { type: String, default: '', maxlength: 5000 },
  progress: { type: String, default: '' },
  startDate: { type: Date },
  endDate: { type: Date },
  isSpoiler: { type: Boolean, default: false },
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  comments: [commentSchema],
}, { timestamps: true })

entrySchema.index({ userId: 1 })
entrySchema.index({ mediaId: 1 })
entrySchema.index({ userId: 1, mediaId: 1 })

export default mongoose.model<IEntry>('Entry', entrySchema)
