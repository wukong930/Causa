import weaviate from "weaviate-client";

let clientInstance: Awaited<ReturnType<typeof weaviate.connectToLocal>> | null = null;

/**
 * Get or create a Weaviate client singleton.
 * Reads connection config from env vars:
 *   WEAVIATE_URL (default: http://localhost:8080)
 *   WEAVIATE_API_KEY (optional)
 */
export async function getWeaviateClient() {
  if (clientInstance) return clientInstance;

  const url = process.env.WEAVIATE_URL || "http://localhost:8080";

  if (process.env.WEAVIATE_API_KEY) {
    clientInstance = await weaviate.connectToCustom({
      httpHost: new URL(url).hostname,
      httpPort: parseInt(new URL(url).port) || 8080,
      httpSecure: url.startsWith("https"),
      grpcHost: process.env.WEAVIATE_GRPC_HOST || new URL(url).hostname,
      grpcPort: parseInt(process.env.WEAVIATE_GRPC_PORT || "50051"),
      grpcSecure: url.startsWith("https"),
      authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY),
    });
  } else {
    clientInstance = await weaviate.connectToLocal({
      host: new URL(url).hostname,
      port: parseInt(new URL(url).port) || 8080,
    });
  }

  return clientInstance;
}

/**
 * Close the Weaviate client connection.
 */
export async function closeWeaviateClient() {
  if (clientInstance) {
    clientInstance.close();
    clientInstance = null;
  }
}
