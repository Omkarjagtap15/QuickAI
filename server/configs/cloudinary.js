import { v2 as cloudinary } from 'cloudinary';

export const connectCloudinary = async () => {
    let cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    let apiKey = process.env.CLOUDINARY_API_KEY;
    let apiSecret = process.env.CLOUDINARY_API_SECRET;

    // Fallback if Vercel still has the old tutorial/stale cloud name or is missing
    if (!cloudName || cloudName === 'df4aamvk' || !apiKey || !apiSecret) {
        cloudName = 'bgom6ngp';
        apiKey = '361294231228758';
        apiSecret = '65ZnWiceA8M9Va80enRrc8KuQd8';
    }

    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
    });

    return cloudinary;
};

// Ensure configured on module load
connectCloudinary();

export default connectCloudinary;
