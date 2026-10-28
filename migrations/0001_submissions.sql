-- Contact form submissions. Times are epoch milliseconds.
CREATE TABLE submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  topic TEXT NOT NULL,
  locale TEXT NOT NULL,
  payload TEXT NOT NULL,
  delivered_at INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  failed_at INTEGER
);

CREATE INDEX submissions_pending ON submissions (delivered_at, failed_at, created_at);
