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

  // Wrap connection in a timeout to avoid hanging if Weaviate is unreachable
  const connectWithTimeout = async <T>(connectFn: () => Promise<T>): Promise<T> => {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Weaviate connection timeout (10s)")), 10_000)
    );
    return Promise.race([connectFn(), timeout]);
  };

  if (process.env.WEAVIATE_API_KEY) {
    clientInstance = await connectWithTimeout(() => weaviate.connectToCustom({
      httpHost: new URL(url).hostname,
      httpPort: parseInt(new URL(url).port) || 8080,
      httpSecure: url.startsWith("https"),
      grpcHost: process.env.WEAVIATE_GRPC_HOST || new URL(url).hostname,
      grpcPort: parseInt(process.env.WEAVIATE_GRPC_PORT || "50051"),
      grpcSecure: url.startsWith("https"),
      authCredentials: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY!),
    }));
  } else {
    const parsedHost = new URL(url).hostname;
    clientInstance = await connectWithTimeout(() => weaviate.connectToLocal({
      host: parsedHost,
      port: parseInt(new URL(url).port) || 8080,
      grpcPort: parseInt(process.env.WEAVIATE_GRPC_PORT || "50051"),
    }));
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
