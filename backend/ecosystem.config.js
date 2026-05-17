module.exports = {
  apps: [{
    name: 'treniko-api',
    script: 'server.js',
    cwd: '/var/www/treniko/backend',
    env: {
      NODE_ENV: 'production',
    },
    env_file: '/var/www/treniko/backend/.env'
  }]
}
