-- Store a per-bookmark favicon URL generated when bookmarks are saved.
PRAGMA foreign_keys = ON;

ALTER TABLE bookmarks ADD COLUMN icon_url TEXT;
