/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ignore the .node modules from onnxruntime-node
      config.externals.push({
        'onnxruntime-node': 'commonjs onnxruntime-node',
      })
    }
    return config
  },
}
module.exports = nextConfig
