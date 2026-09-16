FROM node:20-slim

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Bundle app source
COPY src/ ./src/

# Non-root user for security
USER node

# Start bot
CMD ["node", "src/bot.js"]
