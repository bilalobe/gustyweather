# Use a base Node.js image
FROM node:22-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application code
COPY . .

# Build the Next.js app
RUN npm run build

# Expose the port your app will run on
EXPOSE 3000

# Start the Express.js server
CMD ["node", "server.js"]
