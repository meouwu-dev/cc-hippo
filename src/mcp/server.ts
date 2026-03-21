import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
  upsertArtifact,
  insertEdge,
  getAllArtifacts,
  getAllEdges,
} from './db.js'

const projectId = process.env.SEAL_PROJECT_ID || 'default'

const server = new McpServer({
  name: 'seal',
  version: '1.0.0',
})

server.registerTool(
  'saveArtifact',
  {
    description:
      'Save or update an artifact in the database. Call this after writing a file to register its metadata and type.',
    inputSchema: {
      path: z.string().describe('Relative file path (e.g. "requirements.md")'),
      filename: z
        .string()
        .describe('Just the filename (e.g. "requirements.md")'),
      content: z.string().describe('Full file content'),
      type: z
        .enum(['requirement', 'design', 'preview', 'component', 'other'])
        .default('other')
        .describe('Artifact type'),
    },
  },
  async ({ path, filename, content, type }) => {
    upsertArtifact(projectId, path, filename, content, type)
    return {
      content: [{ type: 'text', text: `Saved artifact: ${path} (${type})` }],
    }
  },
)

server.registerTool(
  'linkArtifacts',
  {
    description:
      'Create a directional relationship between two artifacts. Use this to declare that one artifact references, implements, or derives from another.',
    inputSchema: {
      source_path: z.string().describe('Path of the source artifact'),
      target_path: z.string().describe('Path of the target artifact'),
      kind: z
        .enum(['references', 'implements', 'derives', 'extends'])
        .default('references')
        .describe('Relationship type'),
    },
  },
  async ({ source_path, target_path, kind }) => {
    insertEdge(projectId, source_path, target_path, kind)
    return {
      content: [
        {
          type: 'text',
          text: `Linked: ${source_path} --${kind}--> ${target_path}`,
        },
      ],
    }
  },
)

server.registerTool(
  'getArtifacts',
  {
    description:
      'List all existing artifacts, optionally filtered by type. Use this to see what artifacts already exist before creating new ones.',
    inputSchema: {
      type: z
        .enum(['requirement', 'design', 'preview', 'component', 'other'])
        .optional()
        .describe('Filter by artifact type'),
    },
  },
  async ({ type }) => {
    const artifacts = getAllArtifacts(projectId, type)
    const summary = artifacts.map((a) => `[${a.type}] ${a.path}`).join('\n')
    return {
      content: [
        {
          type: 'text',
          text: artifacts.length
            ? `Found ${artifacts.length} artifact(s):\n${summary}`
            : 'No artifacts found.',
        },
      ],
    }
  },
)

server.registerTool(
  'getRelationships',
  {
    description:
      'List all relationships between artifacts, optionally filtered to a specific artifact path.',
    inputSchema: {
      path: z
        .string()
        .optional()
        .describe('Filter relationships involving this artifact path'),
    },
  },
  async ({ path }) => {
    const edges = getAllEdges(projectId, path)
    const summary = edges
      .map((e) => `${e.source_path} --${e.kind}--> ${e.target_path}`)
      .join('\n')
    return {
      content: [
        {
          type: 'text',
          text: edges.length
            ? `Found ${edges.length} relationship(s):\n${summary}`
            : 'No relationships found.',
        },
      ],
    }
  },
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error('MCP server error:', err)
  process.exit(1)
})
