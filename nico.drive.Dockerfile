# Use an official Node.js runtime as a parent image
FROM node:22.22.1-trixie-slim
 
# Set the working directory in the container for server
WORKDIR /app/webdav_home
WORKDIR /app/thumbs
WORKDIR /app/nico.drive
 
# Copy package.json and package - lock.json to the working directory
COPY ./package*.json ./
 
# Install application dependencies for server
RUN npm install
 
# Copy the rest of the application server code
COPY ./dist/ /app/nico.drive/dist/.
COPY ./client/ /app/nico.drive/client/.
COPY ./tools/ /app/nico.drive/tools/.
COPY ./*.sh /app/nico.drive/.
 
# Expose the port the app runs on
# Should be the same as the .env file used to configure the app
EXPOSE 3000
 
WORKDIR /app/nico.drive

# Define the command to run your app
CMD ["node", "./dist/index.js"]

# MULTI ARCHITECTURE build with the following commands: 
# First, initialise the manifest
# podman manifest create docker.io/hironico/nicodrive:7.14.1

# Build the image attaching them to the manifest
# podman build --platform linux/amd64,linux/arm64 --manifest docker.io/hironico/nicodrive:7.14.1 -f nico.drive.Dockerfile .

# Finally publish the manifest
# podman manifest push docker.io/hironico/nicodrive:7.14.1