import { v2 as cloudinary } from 'cloudinary'

const configureCloudinary = () => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  if (!cloudName) return
  cloudinary.config({
    cloud_name: cloudName,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
}

export { cloudinary }
export default configureCloudinary
