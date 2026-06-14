# --- Stage 1: Build a fully-static dcraw_emu binary -------------------------
# Alpine uses musl libc which is designed for static linking. Every -dev package
# ships a static .a archive, so we can produce a true zero-dependency ELF that
# runs on any Linux container regardless of libc flavour or architecture.
FROM node:22.22.1-trixie-slim AS builder

# Build tools + static development archives for all LibRaw optional deps
RUN apt-get update
RUN apt-get install -y \
    build-essential \
    curl \
    pkgconf \
    libjpeg62-turbo-dev \
    zlib1g-dev \
    liblcms2-dev

# Build LibRaw as a static-only library (--disable-shared avoids generating .so)
RUN curl -L https://www.libraw.org/data/LibRaw-0.22.1.tar.gz -o /tmp/LibRaw.tgz \
    && tar xzf /tmp/LibRaw.tgz -C /tmp 

WORKDIR /tmp/LibRaw-0.22.1

RUN ./configure --enable-static 
RUN make

# --- Stage 2: Lean production image ------------------------------------------
# The build toolchain, LibRaw sources and all intermediate artefacts stay in the
# builder layer and are never included in the published image.
FROM node:22.22.1-trixie-slim

# we need to install the dynamic shared libraries for dcraw_emu we just compiled.
RUN apt-get update
RUN apt-get install -y \
    libjpeg62-turbo \
    zlib1g \
    liblcms2-2 \
    libgomp1

# Create data directories that are usually bind-mounted at runtime
WORKDIR /app/webdav_home
WORKDIR /app/thumbs
WORKDIR /app/nico.drive

# Install Node.js dependencies from package.json
COPY ./package*.json ./
RUN npm install

# Copy application artefacts
COPY ./dist/   /app/nico.drive/dist/.
COPY ./client/ /app/nico.drive/client/.
COPY ./*.sh    /app/nico.drive/.

# Copy only the single fully-static dcraw_emu binary from the builder.
# No shared libraries need to be copied — the binary has zero dynamic deps.
COPY --from=builder /tmp/LibRaw-0.22.1/bin/.libs/dcraw_emu /app/nico.drive/tools/dcraw_emu_linux
COPY --from=builder /tmp/LibRaw-0.22.1/lib/.libs/* /app/nico.drive/tools/
RUN chmod +x /app/nico.drive/tools/dcraw_emu_linux

# Expose the port the app runs on (must match the value in the .env file)
EXPOSE 3000

WORKDIR /app/nico.drive

# Define the command to run the app
CMD ["node", "./dist/index.js"]

# --- Multi-architecture build instructions ------------------------------------
# Initialise the manifest:
#   podman manifest create docker.io/hironico/nicodrive:7.16.3
#
# Build for both amd64 and arm64 and attach to the manifest:
#   podman build --platform linux/amd64,linux/arm64 \
#                --manifest docker.io/hironico/nicodrive:7.16.3 \
#                -f nico.drive.Dockerfile .
#
# Publish the manifest:
#   podman manifest push docker.io/hironico/nicodrive:7.16.3
