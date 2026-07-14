import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://amadinabonu60_db_user:MzjrSB3wR8z1tXAZ@interes.s8sbc63.mongodb.net/?appName=interes'

const userSchema = new mongoose.Schema({
  username: String, email: String, passwordHash: String, avatarUrl: String, bio: String,
  socialLinks: { instagram: String, youtube: String, telegram: String },
  role: { type: String, default: 'user' }, isPrivate: { type: Boolean, default: false },
  telegramId: { type: Number, default: 0 },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true })

const mediaItemSchema = new mongoose.Schema({
  title: String, type: { type: String, enum: ['book', 'game', 'movie', 'series'] },
  coverUrl: { type: String, default: '' }, description: { type: String, default: '' },
  genres: [String], releaseYear: Number,
  isTeamGame: { type: Boolean, default: false }, platform: [String],
}, { timestamps: true })

const entrySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  mediaId: { type: mongoose.Schema.Types.ObjectId, ref: 'MediaItem' },
  status: { type: String, enum: ['planned', 'in_progress', 'completed', 'dropped'], default: 'planned' },
  rating: { type: Number, default: 0 }, review: { type: String, default: '' },
  progress: { type: String, default: '' }, isSpoiler: { type: Boolean, default: false },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  comments: [{ userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, text: String }],
}, { timestamps: true })

const User = mongoose.model('User', userSchema)
const MediaItem = mongoose.model('MediaItem', mediaItemSchema)
const Entry = mongoose.model('Entry', entrySchema)

const users = [
  { username: 'alisher_dev', email: 'alisher@test.com', password: 'pass1234', bio: 'Full-stack developer & movie lover' },
  { username: 'nigora_read', email: 'nigora@test.com', password: 'pass1234', bio: 'Kitobxon va sharh yozuvchi' },
  { username: 'jamshid_gamer', email: 'jamshid@test.com', password: 'pass1234', bio: 'Professional gamer & streamer' },
  { username: 'madina_movie', email: 'madina@test.com', password: 'pass1234', bio: 'Film critic & series addict' },
  { username: 'sarvar_series', email: 'sarvar@test.com', password: 'pass1234', bio: 'Seriallar dunyosida sayohat' },
]

const mediaItems = [
  { title: 'Dune: Part Two', type: 'movie', genres: ['Sci-Fi', 'Adventure'], releaseYear: 2024, description: 'Paul Atreides unites with Chani and the Fremen' },
  { title: 'The Witcher 3: Wild Hunt', type: 'game', genres: ['RPG', 'Action'], releaseYear: 2015, description: 'Open world fantasy RPG', isTeamGame: false, platform: ['PC', 'PS5', 'Xbox'] },
  { title: 'Atomic Habits', type: 'book', genres: ['Self-Help', 'Psychology'], releaseYear: 2018, description: 'Tiny changes, remarkable results by James Clear' },
  { title: 'Breaking Bad', type: 'series', genres: ['Drama', 'Thriller'], releaseYear: 2008, description: 'A chemistry teacher turned meth producer' },
  { title: 'Cyberpunk 2077', type: 'game', genres: ['RPG', 'Open World'], releaseYear: 2020, description: 'Open world action-adventure RPG', isTeamGame: false, platform: ['PC', 'PS5', 'Xbox'] },
  { title: 'Inception', type: 'movie', genres: ['Sci-Fi', 'Thriller'], releaseYear: 2010, description: 'A thief who steals corporate secrets through dream-sharing' },
  { title: 'The Last of Us', type: 'game', genres: ['Action', 'Survival'], releaseYear: 2013, description: 'Post-apocalyptic survival horror', isTeamGame: false, platform: ['PC', 'PS5'] },
  { title: '1984', type: 'book', genres: ['Dystopian', 'Fiction'], releaseYear: 1949, description: 'George Orwell\'s dystopian masterpiece' },
  { title: 'Stranger Things', type: 'series', genres: ['Sci-Fi', 'Horror'], releaseYear: 2016, description: 'Kids in a small town face supernatural forces' },
  { title: 'Oppenheimer', type: 'movie', genres: ['Drama', 'Biography'], releaseYear: 2023, description: 'The story of J. Robert Oppenheimer' },
  { title: 'Elden Ring', type: 'game', genres: ['RPG', 'Action'], releaseYear: 2022, description: 'Action RPG by FromSoftware', isTeamGame: true, platform: ['PC', 'PS5', 'Xbox'] },
  { title: 'Sapiens', type: 'book', genres: ['History', 'Science'], releaseYear: 2011, description: 'A brief history of humankind by Yuval Noah Harari' },
  { title: 'The Office', type: 'series', genres: ['Comedy', 'Mockumentary'], releaseYear: 2005, description: 'A mockumentary on a group of office workers' },
  { title: 'Interstellar', type: 'movie', genres: ['Sci-Fi', 'Drama'], releaseYear: 2014, description: 'A team of explorers travel through a wormhole in space' },
  { title: 'The Mandalorian', type: 'series', genres: ['Sci-Fi', 'Action'], releaseYear: 2019, description: 'A bounty hunter in the outer reaches of the galaxy' },
]

const statuses: Array<'planned' | 'in_progress' | 'completed' | 'dropped'> = ['planned', 'in_progress', 'completed', 'dropped']
const reviews = [
  'Juda yaxshi edi, hammaga tavsiya qilaman!',
  "O'rtacha deb aytsam bo'ladi, yomon emas.",
  'Kutilgan darajada chiqmadi.',
  'Ajoyib asar, qayta-qayta ko\'raman.',
  'Yaxshi lekin oxiri biroz sust yakunlandi.',
  'Mening sevimli asarlarimdan biri!',
  "Birinchi marta ko'rdim, taassurot juda kuchli.",
  "Menga juda yoqdi, 10/10!",
  "O'qish/ko'rish kerak, albatta.",
  'Vaqtga arziydi.',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

async function seed() {
  console.log('🚀 Seeding MongoDB...\n')
  await mongoose.connect(MONGODB_URI)
  console.log('✅ Connected to MongoDB\n')

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    MediaItem.deleteMany({}),
    Entry.deleteMany({}),
  ])
  console.log('🗑️  Cleared existing data\n')

  // Create users
  const createdUsers = []
  for (const u of users) {
    const salt = await bcrypt.genSalt(12)
    const passwordHash = await bcrypt.hash(u.password, salt)
    const user = await User.create({
      username: u.username, email: u.email, passwordHash,
      avatarUrl: '', bio: u.bio, role: 'user',
      socialLinks: { instagram: '', youtube: '', telegram: '' },
    })
    createdUsers.push(user)
    console.log(`👤 Created user: ${user.username}`)
  }

  // Create media items
  const createdMedia = []
  for (const m of mediaItems) {
    const media = await MediaItem.create(m)
    createdMedia.push(media)
    console.log(`🎬 Created media: ${media.title} [${media.type}]`)
  }

  // Create 5 entries for each user
  console.log('\n📝 Creating entries...\n')
  for (const user of createdUsers) {
    const usedMediaIds = new Set<string>()
    for (let i = 0; i < 5; i++) {
      let media: any
      do {
        media = pick(createdMedia)
      } while (usedMediaIds.has(media._id.toString()))
      usedMediaIds.add(media._id.toString())

      const entry = await Entry.create({
        userId: user._id, mediaId: media._id,
        status: statuses[i % statuses.length],
        rating: Math.floor(Math.random() * 5) + 6,
        review: reviews[i % reviews.length],
        isSpoiler: i % 3 === 0,
        startDate: statuses[i % statuses.length] === 'in_progress' ? new Date() : undefined,
        endDate: statuses[i % statuses.length] === 'completed' ? new Date() : undefined,
      })
      console.log(`  ✅ ${user.username} → ${media.title} [${entry.status}] ⭐${entry.rating}`)
    }
  }

  console.log('\n🎉 Seeding complete!')
  console.log(`   👤 ${createdUsers.length} users`)
  console.log(`   🎬 ${createdMedia.length} media items`)
  console.log(`   📝 ${createdUsers.length * 5} entries`)
  await mongoose.disconnect()
  process.exit(0)
}

seed().catch((err) => { console.error('❌ Seed error:', err); process.exit(1) })
