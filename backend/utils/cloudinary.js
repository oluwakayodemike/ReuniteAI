import { v2 as cloudinary } from 'cloudinary';
import streamifier from 'streamifier';

cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

export const uploadImage = async (imageBuffer) => {
  if (!Buffer.isBuffer(imageBuffer)) {
    throw new Error("invalid image buffer provided");
  }

  return await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "reuniteai",
        resource_type: "auto"
      },
      (error, result) => {
        if (error) {
          console.error("error uploading image:", error);
          return reject(new Error("image upload failed"));
        }
        resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(imageBuffer).pipe(stream);
  });
};
