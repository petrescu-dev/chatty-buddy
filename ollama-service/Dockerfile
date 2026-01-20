# Ollama service with gemma-3:4b model pre-loaded
FROM ollama/ollama:rocm

# Create video and render groups for ROCm GPU access
# These must exist for docker-compose group_add to work with group names
# Using direct append to /etc/group as fallback for minimal base images
RUN (grep -q "^video:" /etc/group || echo "video:x:44:" >> /etc/group) && \
    (grep -q "^render:" /etc/group || echo "render:x:991:" >> /etc/group) && \
    echo "Groups in /etc/group:" && grep -E "^(video|render):" /etc/group

# Install curl for health checks
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy the model pull script
COPY pull-model.sh /pull-model.sh
RUN chmod +x /pull-model.sh

# Pull the gemma-3:4b model during build
# This starts ollama serve in the background, pulls the model, then stops the server
RUN /pull-model.sh gemma3:4b

# Expose the default Ollama port
EXPOSE 11434

# Default command (inherited from base image, but explicit for clarity)
CMD ["serve"]
