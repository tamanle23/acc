package com.acc.aio.worker;

import org.postgresql.PGConnection;
import org.postgresql.PGNotification;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.Properties;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Dedicated daemon thread managing an unpooled PostgreSQL connection for LISTEN/NOTIFY.
 * Bypasses HikariCP to eliminate connection recycling, state contamination, and leak detection trips.
 */
public class PostgresNotificationListener implements Runnable {

    private static final Logger log = LoggerFactory.getLogger(PostgresNotificationListener.class);
    public static final String CHANNEL_NAME = "unipost_task_queue";

    private final String url;
    private final Properties props;
    private final SystemTaskWorkerPool workerPool;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private Thread listenerThread;

    public PostgresNotificationListener(String url, String user, String password, SystemTaskWorkerPool workerPool) {
        this.url = url;
        this.props = new Properties();
        if (user != null) {
            props.setProperty("user", user);
        }
        if (password != null) {
            props.setProperty("password", password);
        }
        props.setProperty("autocommit", "true");
        this.workerPool = workerPool;
    }

    public synchronized void start() {
        if (url == null || !url.startsWith("jdbc:postgresql:")) {
            log.info("Skipping PostgreSQL notification listener for non-PostgreSQL URL: {}", url);
            return;
        }
        if (running.compareAndSet(false, true)) {
            listenerThread = createListenerThread(this);
            listenerThread.start();
            log.info("Started reactive PostgreSQL notification listener on thread '{}'", listenerThread.getName());
        }
    }

    private static Thread createListenerThread(Runnable target) {
        try {
            var ofVirtual = Thread.class.getMethod("ofVirtual");
            Object builder = ofVirtual.invoke(null);
            var nameMethod = builder.getClass().getMethod("name", String.class);
            builder = nameMethod.invoke(builder, "pg-task-notify-listener");
            var unstartedMethod = builder.getClass().getMethod("unstarted", Runnable.class);
            return (Thread) unstartedMethod.invoke(builder, target);
        } catch (Exception e) {
            Thread t = new Thread(target, "pg-task-notify-listener");
            t.setDaemon(true);
            return t;
        }
    }

    public synchronized void stop() {
        if (running.compareAndSet(true, false)) {
            if (listenerThread != null) {
                listenerThread.interrupt();
            }
            log.info("Stopped reactive PostgreSQL notification listener");
        }
    }

    public boolean isRunning() {
        return running.get();
    }

    @Override
    public void run() {
        long backoffMs = 1000L;
        while (running.get() && !Thread.currentThread().isInterrupted()) {
            try (Connection conn = DriverManager.getConnection(url, props)) {
                PGConnection pgConn = conn.unwrap(PGConnection.class);
                try (Statement stmt = conn.createStatement()) {
                    stmt.execute("LISTEN " + CHANNEL_NAME);
                }
                log.info("Successfully subscribed to PostgreSQL notification channel '{}'", CHANNEL_NAME);
                backoffMs = 1000L; // Reset backoff on successful connect

                while (running.get() && !Thread.currentThread().isInterrupted()) {
                    PGNotification[] notifications = pgConn.getNotifications(5000); // 5s watchdog
                    if (notifications != null && notifications.length > 0) {
                        workerPool.triggerReactiveDrain();
                    }
                }
            } catch (Exception e) {
                if (!running.get() || Thread.currentThread().isInterrupted()) {
                    break;
                }
                log.warn("PostgreSQL notification socket dropped ({}), reconnecting in {}ms...", e.getMessage(), backoffMs);
                try {
                    Thread.sleep(backoffMs);
                    backoffMs = Math.min(backoffMs * 2, 16000L); // Exponential backoff capped at 16s
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
    }
}
