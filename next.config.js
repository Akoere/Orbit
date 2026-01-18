/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['10.155.76.164'],
  devIndicators: {
    buildActivityPosition: 'top-right', // Move it to a less intrusive position
  },
  // Alternatively, you can hide it completely with CSS in globals.css
};

module.exports = nextConfig;
