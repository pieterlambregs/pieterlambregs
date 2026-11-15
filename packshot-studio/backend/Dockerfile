# Blender's bpy module needs CPython 3.13 on glibc (manylinux_2_28).
FROM python:3.13-slim-bookworm

# Runtime libraries for bpy (X11/GL stubs are needed even headless) and OpenCV.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libxrender1 libxxf86vm1 libxfixes3 libxi6 libxkbcommon0 libsm6 libgl1 libegl1 \
        libglib2.0-0 libgomp1 libxext6 libx11-6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt && pip install --no-cache-dir bpy==5.3.0

COPY backend/ /app/backend/
# Frontend build is copied in by the multi-stage target below (api image only).
ENV PACKSHOT_DATA=/data PYTHONUNBUFFERED=1
VOLUME /data
