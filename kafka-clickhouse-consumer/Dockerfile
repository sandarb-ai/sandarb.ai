FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY consumer_bridge.py .

# Non-root user for security
RUN useradd -r -s /bin/false consumer && chown -R consumer:consumer /app
USER consumer

# Health check port
EXPOSE 8079

# Graceful shutdown: SIGTERM -> consumer close -> flush -> exit
STOPSIGNAL SIGTERM

CMD ["python", "-u", "consumer_bridge.py"]
