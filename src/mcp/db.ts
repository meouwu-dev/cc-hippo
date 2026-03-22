import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

const DB_DIR = path.resolve(import.meta.dirname ?? '.', '../../data')
const DB_PATH = path.join(DB_DIR, 'app.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true })
  }

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'Chat 1',
      session_id TEXT,
      model TEXT NOT NULL DEFAULT 'default',
      effort TEXT NOT NULL DEFAULT 'default',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'Page 1',
      sort_order INTEGER NOT NULL DEFAULT 0,
      user_renamed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      section_id TEXT,
      path TEXT NOT NULL,
      filename TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'other',
      device_preset TEXT,
      position_x REAL NOT NULL DEFAULT 0,
      position_y REAL NOT NULL DEFAULT 0,
      width REAL NOT NULL DEFAULT 480,
      height REAL NOT NULL DEFAULT 400,
      minimized INTEGER NOT NULL DEFAULT 0,
      pre_minimize_height REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, path)
    );

    CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
      target_artifact_id TEXT NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'references',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, source_artifact_id, target_artifact_id)
    );

    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      position_x REAL NOT NULL DEFAULT 0,
      position_y REAL NOT NULL DEFAULT 0,
      width REAL NOT NULL DEFAULT 800,
      height REAL NOT NULL DEFAULT 600,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      thinking TEXT,
      artifacts TEXT,
      questions TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  // Migrations for existing DBs
  const pageColumns = db.prepare("PRAGMA table_info('pages')").all() as {
    name: string
  }[]
  if (!pageColumns.some((c) => c.name === 'user_renamed')) {
    db.exec(
      'ALTER TABLE pages ADD COLUMN user_renamed INTEGER NOT NULL DEFAULT 0',
    )
  }

  const msgColumns = db.prepare("PRAGMA table_info('chat_messages')").all() as {
    name: string
  }[]
  if (!msgColumns.some((c) => c.name === 'questions')) {
    db.exec('ALTER TABLE chat_messages ADD COLUMN questions TEXT')
  }

  if (!pageColumns.some((c) => c.name === 'viewport_x')) {
    db.exec('ALTER TABLE pages ADD COLUMN viewport_x REAL')
    db.exec('ALTER TABLE pages ADD COLUMN viewport_y REAL')
    db.exec('ALTER TABLE pages ADD COLUMN viewport_zoom REAL')
  }

  return db
}

// ---- Projects ----

export interface ProjectRow {
  id: string
  name: string
  created_at: string
}

export function createProject(name: string): ProjectRow {
  const db = getDb()
  const id = crypto.randomUUID()
  db.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run(id, name)
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow
}

export function getAllProjects(): ProjectRow[] {
  const db = getDb()
  return db
    .prepare('SELECT * FROM projects ORDER BY created_at')
    .all() as ProjectRow[]
}

export function deleteProject(projectId: string): void {
  const db = getDb()
  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId)
}

// ---- Conversations ----

export interface ConversationRow {
  id: string
  project_id: string
  name: string
  session_id: string | null
  model: string
  effort: string
  created_at: string
}

export function createConversation(
  projectId: string,
  name = 'Chat 1',
  model?: string,
  effort?: string,
): ConversationRow {
  const db = getDb()
  const id = crypto.randomUUID()
  db.prepare(
    'INSERT INTO conversations (id, project_id, name, model, effort) VALUES (?, ?, ?, ?, ?)',
  ).run(id, projectId, name, model ?? 'default', effort ?? 'default')
  return db
    .prepare('SELECT * FROM conversations WHERE id = ?')
    .get(id) as ConversationRow
}

export function getConversations(projectId: string): ConversationRow[] {
  const db = getDb()
  return db
    .prepare(
      'SELECT * FROM conversations WHERE project_id = ? ORDER BY created_at',
    )
    .all(projectId) as ConversationRow[]
}

export function deleteConversation(conversationId: string): void {
  const db = getDb()
  db.prepare('DELETE FROM conversations WHERE id = ?').run(conversationId)
}

export function renameConversation(conversationId: string, name: string): void {
  const db = getDb()
  db.prepare('UPDATE conversations SET name = ? WHERE id = ?').run(
    name,
    conversationId,
  )
}

export function updateConversationSettings(
  conversationId: string,
  model: string,
  effort: string,
): void {
  const db = getDb()
  db.prepare('UPDATE conversations SET model = ?, effort = ? WHERE id = ?').run(
    model,
    effort,
    conversationId,
  )
}

export function getOrCreateSessionId(conversationId: string): string {
  const db = getDb()
  const row = db
    .prepare('SELECT session_id FROM conversations WHERE id = ?')
    .get(conversationId) as { session_id: string | null } | undefined
  if (row?.session_id) return row.session_id
  const sessionId = crypto.randomUUID()
  db.prepare('UPDATE conversations SET session_id = ? WHERE id = ?').run(
    sessionId,
    conversationId,
  )
  return sessionId
}

// ---- Artifacts ----

export interface ArtifactRow {
  id: string
  project_id: string
  page_id: string
  section_id: string | null
  path: string
  filename: string
  content: string
  type: string
  device_preset: string | null
  position_x: number
  position_y: number
  width: number
  height: number
  minimized: number
  pre_minimize_height: number | null
  created_at: string
  updated_at: string
}

export function upsertArtifact(
  projectId: string,
  artifactPath: string,
  filename: string,
  content: string,
  type = 'other',
  pageId?: string | null,
  sectionId?: string | null,
  devicePreset?: string | null,
  posX?: number | null,
  posY?: number | null,
) {
  const db = getDb()
  // If no pageId provided, use the default page
  const resolvedPageId = pageId ?? ensureDefaultPage(projectId).id
  db.prepare(
    `INSERT INTO artifacts (id, project_id, page_id, path, filename, content, type, section_id, device_preset, position_x, position_y)
     VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, path) DO UPDATE SET
       filename = excluded.filename,
       content = CASE WHEN excluded.content = '' THEN content ELSE excluded.content END,
       type = excluded.type,
       page_id = COALESCE(excluded.page_id, page_id),
       section_id = COALESCE(excluded.section_id, section_id),
       device_preset = COALESCE(excluded.device_preset, device_preset),
       position_x = CASE WHEN excluded.position_x != 0 THEN excluded.position_x ELSE position_x END,
       position_y = CASE WHEN excluded.position_y != 0 THEN excluded.position_y ELSE position_y END,
       updated_at = datetime('now')`,
  ).run(
    projectId,
    resolvedPageId,
    artifactPath,
    filename,
    content,
    type,
    sectionId ?? null,
    devicePreset ?? null,
    posX ?? 0,
    posY ?? 0,
  )
}

export function getAllArtifacts(
  projectId: string,
  type?: string,
): ArtifactRow[] {
  const db = getDb()
  if (type) {
    return db
      .prepare('SELECT * FROM artifacts WHERE project_id = ? AND type = ?')
      .all(projectId, type) as ArtifactRow[]
  }
  return db
    .prepare('SELECT * FROM artifacts WHERE project_id = ?')
    .all(projectId) as ArtifactRow[]
}

export function getArtifactsByPage(
  projectId: string,
  pageId: string,
): ArtifactRow[] {
  const db = getDb()
  return db
    .prepare('SELECT * FROM artifacts WHERE project_id = ? AND page_id = ?')
    .all(projectId, pageId) as ArtifactRow[]
}

export function getArtifactByPath(
  projectId: string,
  artifactPath: string,
): ArtifactRow | undefined {
  const db = getDb()
  return db
    .prepare('SELECT * FROM artifacts WHERE project_id = ? AND path = ?')
    .get(projectId, artifactPath) as ArtifactRow | undefined
}

export function updateArtifactPosition(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const db = getDb()
  db.prepare(
    "UPDATE artifacts SET position_x = ?, position_y = ?, width = ?, height = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(x, y, w, h, id)
}

export function updateArtifactPositionByPath(
  projectId: string,
  path: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const db = getDb()
  db.prepare(
    "UPDATE artifacts SET position_x = ?, position_y = ?, width = ?, height = ?, updated_at = datetime('now') WHERE project_id = ? AND path = ?",
  ).run(x, y, w, h, projectId, path)
}

/**
 * Upsert artifact row with content AND position in one shot.
 * Called when the client receives a file SSE event so the artifact
 * exists in DB immediately — not only after the MCP saveArtifact call.
 */
export function upsertArtifactWithPosition(
  projectId: string,
  pageId: string | null,
  path: string,
  filename: string,
  content: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const db = getDb()
  const resolvedPageId = pageId ?? ensureDefaultPage(projectId).id
  db.prepare(
    `INSERT INTO artifacts (id, project_id, page_id, path, filename, content, type, position_x, position_y, width, height)
     VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, 'other', ?, ?, ?, ?)
     ON CONFLICT(project_id, path) DO UPDATE SET
       filename = excluded.filename,
       content = excluded.content,
       position_x = excluded.position_x,
       position_y = excluded.position_y,
       width = excluded.width,
       height = excluded.height,
       updated_at = datetime('now')`,
  ).run(projectId, resolvedPageId, path, filename, content, x, y, w, h)
}

export function updateArtifactDevicePreset(
  id: string,
  devicePreset: string | null,
): void {
  const db = getDb()
  db.prepare(
    "UPDATE artifacts SET device_preset = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(devicePreset, id)
}

export function updateArtifactMinimized(
  id: string,
  minimized: boolean,
  preMinimizeHeight?: number | null,
): void {
  const db = getDb()
  db.prepare(
    "UPDATE artifacts SET minimized = ?, pre_minimize_height = ?, updated_at = datetime('now') WHERE id = ?",
  ).run(minimized ? 1 : 0, preMinimizeHeight ?? null, id)
}

// ---- Edges ----

export interface EdgeRow {
  id: string
  project_id: string
  source_artifact_id: string
  target_artifact_id: string
  kind: string
  created_at: string
}

export function insertEdge(
  projectId: string,
  sourceArtifactId: string,
  targetArtifactId: string,
  kind = 'references',
) {
  const db = getDb()
  db.prepare(
    `INSERT OR IGNORE INTO edges (id, project_id, source_artifact_id, target_artifact_id, kind)
     VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)`,
  ).run(projectId, sourceArtifactId, targetArtifactId, kind)
}

export function insertEdgeByPath(
  projectId: string,
  sourcePath: string,
  targetPath: string,
  kind = 'references',
) {
  const source = getArtifactByPath(projectId, sourcePath)
  const target = getArtifactByPath(projectId, targetPath)
  if (!source || !target) return
  insertEdge(projectId, source.id, target.id, kind)
}

export function getEdgesByPage(projectId: string, pageId: string): EdgeRow[] {
  const db = getDb()
  return db
    .prepare(
      `SELECT e.* FROM edges e
       JOIN artifacts sa ON e.source_artifact_id = sa.id
       WHERE e.project_id = ? AND sa.page_id = ?`,
    )
    .all(projectId, pageId) as EdgeRow[]
}

export function getAllEdges(
  projectId: string,
  artifactPath?: string,
): EdgeRow[] {
  const db = getDb()
  if (artifactPath) {
    const artifact = getArtifactByPath(projectId, artifactPath)
    if (!artifact) return []
    return db
      .prepare(
        'SELECT * FROM edges WHERE project_id = ? AND (source_artifact_id = ? OR target_artifact_id = ?)',
      )
      .all(projectId, artifact.id, artifact.id) as EdgeRow[]
  }
  return db
    .prepare('SELECT * FROM edges WHERE project_id = ?')
    .all(projectId) as EdgeRow[]
}

// ---- Pages ----

export interface PageRow {
  id: string
  project_id: string
  name: string
  sort_order: number
  user_renamed: number
  created_at: string
  viewport_x: number | null
  viewport_y: number | null
  viewport_zoom: number | null
}

export function createPage(
  projectId: string,
  name: string,
  sortOrder = 0,
): PageRow {
  const db = getDb()
  const id = crypto.randomUUID()
  db.prepare(
    'INSERT INTO pages (id, project_id, name, sort_order) VALUES (?, ?, ?, ?)',
  ).run(id, projectId, name, sortOrder)
  return db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as PageRow
}

export function getPages(projectId: string): PageRow[] {
  const db = getDb()
  return db
    .prepare(
      'SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order, created_at',
    )
    .all(projectId) as PageRow[]
}

export function renamePage(
  pageId: string,
  name: string,
  userRenamed?: boolean,
): void {
  const db = getDb()
  if (userRenamed !== undefined) {
    db.prepare('UPDATE pages SET name = ?, user_renamed = ? WHERE id = ?').run(
      name,
      userRenamed ? 1 : 0,
      pageId,
    )
  } else {
    db.prepare('UPDATE pages SET name = ? WHERE id = ?').run(name, pageId)
  }
}

export function deletePage(pageId: string): void {
  const db = getDb()
  db.prepare('DELETE FROM pages WHERE id = ?').run(pageId)
}

export function savePageViewport(
  pageId: string,
  x: number,
  y: number,
  zoom: number,
): void {
  const db = getDb()
  db.prepare(
    'UPDATE pages SET viewport_x = ?, viewport_y = ?, viewport_zoom = ? WHERE id = ?',
  ).run(x, y, zoom, pageId)
}

export function ensureDefaultPage(projectId: string): PageRow {
  const db = getDb()
  const existing = db
    .prepare(
      'SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order LIMIT 1',
    )
    .get(projectId) as PageRow | undefined
  if (existing) return existing

  return createPage(projectId, 'Page 1', 0)
}

// ---- Sections ----

export interface SectionRow {
  id: string
  page_id: string
  project_id: string
  name: string
  position_x: number
  position_y: number
  width: number
  height: number
  created_at: string
}

export function createSection(
  pageId: string,
  projectId: string,
  name: string,
  x = 0,
  y = 0,
): SectionRow {
  const db = getDb()
  const id = crypto.randomUUID()
  db.prepare(
    'INSERT INTO sections (id, page_id, project_id, name, position_x, position_y) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, pageId, projectId, name, x, y)
  return db.prepare('SELECT * FROM sections WHERE id = ?').get(id) as SectionRow
}

export function getSections(projectId: string, pageId?: string): SectionRow[] {
  const db = getDb()
  if (pageId) {
    return db
      .prepare('SELECT * FROM sections WHERE project_id = ? AND page_id = ?')
      .all(projectId, pageId) as SectionRow[]
  }
  return db
    .prepare('SELECT * FROM sections WHERE project_id = ?')
    .all(projectId) as SectionRow[]
}

export function updateSection(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const db = getDb()
  db.prepare(
    'UPDATE sections SET position_x = ?, position_y = ?, width = ?, height = ? WHERE id = ?',
  ).run(x, y, w, h, id)
}

export function deleteSection(id: string): void {
  const db = getDb()
  db.prepare('UPDATE artifacts SET section_id = NULL WHERE section_id = ?').run(
    id,
  )
  db.prepare('DELETE FROM sections WHERE id = ?').run(id)
}

// ---- Chat Messages ----

export interface ChatMessageRow {
  id: string
  conversation_id: string
  role: string
  content: string
  thinking: string | null
  artifacts: string | null
  questions: string | null
  created_at: string
}

export function getChatMessages(conversationId: string): ChatMessageRow[] {
  const db = getDb()
  return db
    .prepare(
      'SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at',
    )
    .all(conversationId) as ChatMessageRow[]
}

export function saveChatMessages(
  conversationId: string,
  messages: {
    id: string
    role: string
    content: string
    timestamp?: number
    thinking?: string[]
    artifacts?: unknown[]
    questions?: unknown[]
  }[],
): void {
  const db = getDb()
  const upsert = db.prepare(
    `INSERT INTO chat_messages (id, conversation_id, role, content, thinking, artifacts, questions, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       content = excluded.content,
       thinking = excluded.thinking,
       artifacts = excluded.artifacts,
       questions = excluded.questions`,
  )
  const tx = db.transaction(() => {
    for (const msg of messages) {
      upsert.run(
        msg.id,
        conversationId,
        msg.role,
        msg.content,
        msg.thinking?.length ? JSON.stringify(msg.thinking) : null,
        JSON.stringify(msg.artifacts ?? []),
        msg.questions ? JSON.stringify(msg.questions) : null,
        msg.timestamp
          ? new Date(msg.timestamp).toISOString()
          : new Date().toISOString(),
      )
    }
  })
  tx()
}

export function deleteChatMessages(conversationId: string): void {
  const db = getDb()
  db.prepare('DELETE FROM chat_messages WHERE conversation_id = ?').run(
    conversationId,
  )
}

// ---- App State ----

export function getAppState(key: string): string | null {
  const db = getDb()
  const row = db
    .prepare('SELECT value FROM app_state WHERE key = ?')
    .get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setAppState(key: string, value: string): void {
  const db = getDb()
  db.prepare(
    `INSERT INTO app_state (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value)
}
