# Runs the room server anywhere that builds a Dockerfile (Railway, Fly, Render, a VPS).
# The server needs nothing but Python's standard library.
FROM python:3.12-slim
WORKDIR /app
COPY . .
ENV PYTHONUNBUFFERED=1
# The host sets PORT. Set ROOM_KEY and ADMIN_KEY as secrets so the links survive a restart.
CMD ["python3", "kit/server.py"]
