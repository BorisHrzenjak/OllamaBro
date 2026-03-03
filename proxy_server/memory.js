'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');

const MEMORY_DIR = process.env.MEMORY_DIR
    || path.join(os.homedir(), '.ollamabar', 'memory');
const EMBED_MODEL = process.env.MEMORY_EMBED_MODEL || 'nomic-embed-text';
const OLLAMA_BASE = (process.env.OLLAMA_API_BASE_URL || 'http://localhost:11434').replace(/\/$/, '');

let _index = null;

async function embedTexts(inputs) {
    const resp = await fetch(`${OLLAMA_BASE}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: EMBED_MODEL, input: inputs })
    });
    if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`Ollama embed HTTP ${resp.status}: ${text}`);
    }
    const data = await resp.json();
    if (!data.embeddings || data.embeddings.length === 0) {
        throw new Error('Ollama returned empty embeddings — is nomic-embed-text pulled?');
    }
    return data.embeddings;
}

async function getIndex() {
    if (_index) return _index;
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
    const { LocalDocumentIndex } = await import('vectra');
    const idx = new LocalDocumentIndex({
        folderPath: MEMORY_DIR,
        embeddings: { model: EMBED_MODEL, create: embedTexts }
    });
    if (!(await idx.isCatalogCreated())) {
        await idx.createIndex();
    }
    _index = idx;
    return _index;
}

async function addMemory(text, metadata = {}) {
    const index = await getIndex();
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await index.upsertDocument(id, text, {
        text,
        timestamp: new Date().toISOString(),
        ...metadata
    });
    return id;
}

async function searchMemories(query, k = 3) {
    try {
        const index = await getIndex();
        const results = await index.queryDocuments(query, { maxDocuments: k });
        return results
            .filter(r => r.score > 0.1)
            .map(r => ({
                id: r.uri,
                text: r.document?.metadata?.text ?? '',
                score: r.score,
                timestamp: r.document?.metadata?.timestamp
            }));
    } catch (err) {
        console.warn('[Memory] Search failed:', err.message);
        return [];
    }
}

async function listMemories() {
    try {
        const index = await getIndex();
        const docs = await index.listDocuments();
        return docs
            .map(d => ({
                id: d.uri,
                text: d.metadata?.text ?? '',
                timestamp: d.metadata?.timestamp,
                source: d.metadata?.source
            }))
            .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
    } catch (err) {
        console.warn('[Memory] List failed:', err.message);
        return [];
    }
}

async function deleteMemory(id) {
    const index = await getIndex();
    await index.deleteDocument(id);
}

async function clearMemories() {
    _index = null;
    try { fs.rmSync(MEMORY_DIR, { recursive: true, force: true }); } catch { /* ignore */ }
    fs.mkdirSync(MEMORY_DIR, { recursive: true });
    await getIndex(); // re-init with fresh index
}

async function getStatus() {
    try {
        const resp = await fetch(`${OLLAMA_BASE}/api/tags`);
        if (!resp.ok) return { available: false, reason: 'Ollama not reachable', count: 0 };
        const data = await resp.json();
        const models = data.models || [];
        const hasEmbed = models.some(m => m.name && m.name.startsWith('nomic-embed-text'));
        const memories = await listMemories();
        return {
            available: hasEmbed,
            embedModel: EMBED_MODEL,
            memoryDir: MEMORY_DIR,
            count: memories.length,
            reason: hasEmbed ? null : `Run: ollama pull ${EMBED_MODEL}`
        };
    } catch (err) {
        return { available: false, reason: err.message, count: 0 };
    }
}

module.exports = { addMemory, searchMemories, listMemories, deleteMemory, clearMemories, getStatus };
