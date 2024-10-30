# Use a base Node.js image
FROM node:22-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install --verbose

# Copy the rest of the application code
COPY . .

# Expose the port your app will run on
EXPOSE 3000

# Start the Next.js development server
CMD ["npm", "run", "dev"]

# Uncomment the following lines to use Express.js server
# COPY server.js ./
# CMD ["node", "server.js"]