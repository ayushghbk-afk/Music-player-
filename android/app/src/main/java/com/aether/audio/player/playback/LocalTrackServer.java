package com.aether.audio.player.playback;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Tiny HTTP server bound to 127.0.0.1 that lets the WebView stream imported
 * audio files to native storage as raw bytes — no Base64, no Capacitor bridge,
 * no full-file buffers. The WebView POSTs the File/Blob body directly:
 *
 *   CapacitorWebFetch('http://127.0.0.1:<port>/import/<trackId>?ext=flac&token=…',
 *                      { method: 'POST', body: blob })
 *
 * The body is written to a temp file in 64 KB chunks and atomically renamed
 * into the {@link TrackStore} when complete. Loopback HTTP is treated as a
 * potentially-trustworthy origin by the WebView, and cleartext is permitted
 * for 127.0.0.1/localhost only via the network security config.
 */
public final class LocalTrackServer {

    private static final int MAX_HEADER_BYTES = 16 * 1024;
    private static final int COPY_BUFFER_BYTES = 64 * 1024;
    private static final int SOCKET_TIMEOUT_MS = 30_000;

    private final TrackStore trackStore;
    private final String token;
    private final ExecutorService connections = Executors.newCachedThreadPool();
    private ServerSocket serverSocket;
    private volatile boolean running;

    private LocalTrackServer(TrackStore trackStore, ServerSocket socket) {
        this.trackStore = trackStore;
        this.token = UUID.randomUUID().toString() + "-" + UUID.randomUUID();
        this.serverSocket = socket;
    }

    /** Starts the server on a random loopback port. Throws on failure. */
    public static LocalTrackServer start(TrackStore store) throws IOException {
        ServerSocket socket = new ServerSocket(0, 8, InetAddress.getByName("127.0.0.1"));
        LocalTrackServer server = new LocalTrackServer(store, socket);
        server.running = true;
        Thread acceptThread = new Thread(server::acceptLoop, "aether-track-server");
        acceptThread.setDaemon(true);
        acceptThread.start();
        return server;
    }

    public int getPort() {
        return serverSocket.getLocalPort();
    }

    public String getToken() {
        return token;
    }

    public boolean isRunning() {
        return running && !serverSocket.isClosed();
    }

    public void stop() {
        running = false;
        try {
            serverSocket.close();
        } catch (IOException ignored) {
        }
        connections.shutdownNow();
    }

    private void acceptLoop() {
        while (running) {
            try {
                Socket socket = serverSocket.accept();
                socket.setSoTimeout(SOCKET_TIMEOUT_MS);
                connections.execute(() -> handle(socket));
            } catch (IOException e) {
                if (running) {
                    // accept failed transiently; brief backoff before retrying
                    try {
                        Thread.sleep(100);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return;
                    }
                }
            }
        }
    }

    private void handle(Socket socket) {
        try (Socket s = socket) {
            BufferedInputStream in = new BufferedInputStream(s.getInputStream());
            OutputStream rawOut = s.getOutputStream();

            String[] requestLine = readLine(in).split(" ");
            if (requestLine.length < 2) {
                respond(rawOut, 400, "Bad Request", "{\"ok\":false}");
                return;
            }
            String method = requestLine[0].toUpperCase();
            String rawTarget = requestLine[1];

            Map<String, String> headers = readHeaders(in);

            int queryStart = rawTarget.indexOf('?');
            String path = queryStart >= 0 ? rawTarget.substring(0, queryStart) : rawTarget;
            Map<String, String> query = parseQuery(queryStart >= 0 ? rawTarget.substring(queryStart + 1) : "");

            if ("OPTIONS".equals(method)) {
                // CORS preflight for the WebView fetch (Blob bodies send a
                // non-safelisted Content-Type such as audio/flac).
                respond(rawOut, 204, "No Content", null);
                return;
            }

            if (!tokenMatches(query.get("token"))) {
                respond(rawOut, 403, "Forbidden", "{\"ok\":false}");
                return;
            }

            if ("GET".equals(method) && "/ping".equals(path)) {
                respond(rawOut, 200, "OK", "{\"ok\":true}");
                return;
            }

            if ("POST".equals(method) && path.startsWith("/import/")) {
                String trackId = decode(path.substring("/import/".length()));
                String extension = query.containsKey("ext") ? decode(query.get("ext")) : "bin";
                long bytes = importTrack(in, rawOut, headers, trackId, extension);
                if (bytes >= 0) {
                    respond(rawOut, 200, "OK", "{\"ok\":true,\"bytes\":" + bytes + "}");
                }
                return;
            }

            respond(rawOut, 404, "Not Found", "{\"ok\":false}");
        } catch (Exception ignored) {
            // Connection-level failure; the JS side retries / falls back to
            // the chunked plugin import.
        }
    }

    private long importTrack(InputStream in, OutputStream rawOut, Map<String, String> headers,
                             String trackId, String extension) throws IOException {
        TrackStore.TempWrite write = null;
        try {
            write = trackStore.beginWrite(trackId, extension);
            long total;
            String transferEncoding = headers.get("transfer-encoding");
            if (transferEncoding != null && transferEncoding.toLowerCase().contains("chunked")) {
                total = copyChunked(in, write.out);
            } else {
                String contentLength = headers.get("content-length");
                if (contentLength == null) {
                    respond(rawOut, 411, "Length Required", "{\"ok\":false,\"error\":\"missing content-length\"}");
                    return -1;
                }
                long length = Long.parseLong(contentLength.trim());
                total = copyFully(in, write.out, length);
            }
            trackStore.finishWrite(write);
            return total;
        } catch (Exception e) {
            if (write != null) {
                trackStore.abortWrite(write);
            }
            throw e;
        }
    }

    private static long copyFully(InputStream in, OutputStream out, long length) throws IOException {
        byte[] buffer = new byte[COPY_BUFFER_BYTES];
        long remaining = length;
        long total = 0;
        while (remaining > 0) {
            int toRead = (int) Math.min(buffer.length, remaining);
            int read = in.read(buffer, 0, toRead);
            if (read < 0) break;
            out.write(buffer, 0, read);
            remaining -= read;
            total += read;
        }
        if (total != length) {
            throw new IOException("Truncated upload: expected " + length + " bytes, got " + total);
        }
        return total;
    }

    private static long copyChunked(InputStream in, OutputStream out) throws IOException {
        byte[] buffer = new byte[COPY_BUFFER_BYTES];
        long total = 0;
        while (true) {
            String sizeLine = readLine(in);
            int semicolon = sizeLine.indexOf(';');
            if (semicolon >= 0) sizeLine = sizeLine.substring(0, semicolon);
            long chunkSize = Long.parseLong(sizeLine.trim(), 16);
            if (chunkSize == 0) {
                // Trailing headers until blank line (or immediate EOF of headers).
                readLine(in);
                return total;
            }
            long remaining = chunkSize;
            while (remaining > 0) {
                int toRead = (int) Math.min(buffer.length, remaining);
                int read = in.read(buffer, 0, toRead);
                if (read < 0) {
                    throw new IOException("Truncated chunked upload");
                }
                out.write(buffer, 0, read);
                remaining -= read;
                total += read;
            }
            // Consume CRLF after each chunk.
            //noinspection ResultOfMethodCallIgnored
            in.read();
            //noinspection ResultOfMethodCallIgnored
            in.read();
        }
    }

    private static String readLine(InputStream in) throws IOException {
        StringBuilder builder = new StringBuilder(64);
        int totalRead = 0;
        int c = in.read();
        while (c != -1 && c != '\n') {
            if (c != '\r') {
                builder.append((char) c);
                totalRead++;
                if (totalRead > MAX_HEADER_BYTES) {
                    throw new IOException("HTTP header line too long");
                }
            }
            c = in.read();
        }
        if (c == -1 && builder.length() == 0) {
            throw new IOException("Connection closed before request completed");
        }
        return builder.toString();
    }

    private static Map<String, String> readHeaders(InputStream in) throws IOException {
        Map<String, String> headers = new HashMap<>();
        int total = 0;
        while (true) {
            String line = readLine(in);
            if (line.isEmpty()) break;
            total += line.length();
            if (total > MAX_HEADER_BYTES) {
                throw new IOException("HTTP headers too large");
            }
            int colon = line.indexOf(':');
            if (colon <= 0) continue;
            headers.put(line.substring(0, colon).trim().toLowerCase(), line.substring(colon + 1).trim());
        }
        return headers;
    }

    private static Map<String, String> parseQuery(String query) {
        Map<String, String> result = new HashMap<>();
        if (query == null || query.isEmpty()) return result;
        for (String pair : query.split("&")) {
            int eq = pair.indexOf('=');
            if (eq <= 0) continue;
            result.put(decode(pair.substring(0, eq)), decode(pair.substring(eq + 1)));
        }
        return result;
    }

    private static String decode(String value) {
        try {
            return URLDecoder.decode(value, "UTF-8");
        } catch (Exception e) {
            return value;
        }
    }

    private boolean tokenMatches(String provided) {
        if (provided == null || provided.isEmpty()) return false;
        return java.security.MessageDigest.isEqual(
                token.getBytes(StandardCharsets.UTF_8),
                provided.getBytes(StandardCharsets.UTF_8));
    }

    private static void respond(OutputStream out, int status, String reason, String body) throws IOException {
        PrintWriter writer = new PrintWriter(new java.io.OutputStreamWriter(out, StandardCharsets.UTF_8), true);
        writer.print("HTTP/1.1 " + status + " " + reason + "\r\n");
        writer.print("Access-Control-Allow-Origin: *\r\n");
        writer.print("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n");
        writer.print("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With\r\n");
        writer.print("Access-Control-Max-Age: 86400\r\n");
        if (body != null) {
            byte[] payload = body.getBytes(StandardCharsets.UTF_8);
            writer.print("Content-Type: application/json\r\n");
            writer.print("Content-Length: " + payload.length + "\r\n");
            writer.print("Connection: close\r\n\r\n");
            writer.flush();
            out.write(payload);
            out.flush();
        } else {
            writer.print("Content-Length: 0\r\n");
            writer.print("Connection: close\r\n\r\n");
            writer.flush();
        }
    }
}
