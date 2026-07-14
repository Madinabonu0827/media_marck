import mongoose, { Schema, Document } from 'mongoose'

export interface IMediaItem extends Document {
  title: string
  type: 'book' | 'game' | 'movie' | 'series'
  coverUrl: string
  description: string
  genres: string[]
  releaseYear: number
  isTeamGame: boolean
  platform: string[]
}

const mediaItemSchema = new Schema<IMediaItem>({
  title: { type: String, required: true, trim: true },
  type: { type: String, enum: ['book', 'game', 'movie', 'series'], required: true },
  coverUrl: { type: String, default: '' },
  description: { type: String, default: '' },
  genres: [{ type: String, trim: true }],
  releaseYear: { type: Number, required: true },
  isTeamGame: { type: Boolean, default: false },
  platform: [{ type: String, trim: true }],
}, { timestamps: true })

mediaItemSchema.index({ title: 'text' })
mediaItemSchema.index({ type: 1 })
mediaItemSchema.index({ genres: 1 })

export default mongoose.model<IMediaItem>('MediaItem', mediaItemSchema)
