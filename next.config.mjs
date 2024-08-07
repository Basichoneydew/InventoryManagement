/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
        domains: ['firebasestorage.googleapis.com', 'example.com', 'another-domain.com'],
    },
}

export default nextConfig