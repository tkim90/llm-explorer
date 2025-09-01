# Forager RAG System

A vectorless RAG (Retrieval Augmented Generation) implementation that uses tools like ripgrep and semantic document analysis instead of traditional vector databases.

## Features

- **PDF Document Processing**: Upload and automatically extract text, generate summaries, tags, and references for each page
- **AI-Powered Query Processing**: Use GPT-4 with tool-calling capabilities to search through documents intelligently
- **Semantic Search**: Find relevant content using natural language queries
- **Reference Following**: Automatically discover and follow cross-references between document pages
- **Type-Safe API**: Built with TRPC for end-to-end type safety

## Tech Stack

- **Runtime**: Bun
- **Framework**: Next.js 14 with App Router
- **Frontend**: React with Tailwind CSS
- **Backend**: Next.js API Routes with TRPC
- **AI**: Vercel AI SDK with OpenAI GPT-4
- **PDF Processing**: pdf-parse

## Setup

1. **Install dependencies**:
   ```bash
   bun install
   ```

2. **Environment Setup**:
   Copy `.env.example` to `.env.local` and add your OpenAI API key:
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local`:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

3. **Development**:
   ```bash
   bun run dev
   ```

4. **Production**:
   ```bash
   bun run build
   bun run start
   ```

## How It Works

### Core Workflow

1. **Upload**: User uploads a PDF document (100+ pages)
2. **Processing**: Backend extracts text from each page and creates DocumentPage structures
3. **Analysis**: AI generates summaries, tags, and extracts references for each page
4. **Query**: User asks questions about the document
5. **Search**: AI agent uses tools to gather relevant context across multiple pages
6. **Answer**: System provides comprehensive answers with source references

### DocumentPage Structure

Each page contains:
- `pageNbr`: PDF page number
- `pageContentNbr`: Page number shown in document (optional)
- `content`: Extracted text content
- `summary`: AI-generated 1-5 sentence summary
- `tags`: Semantic topic tags for retrieval
- `references`: Section numbers, chapter references, etc.

### AI Agent Tools

The query agent has access to:
- `search_pages`: Find pages containing keywords
- `get_page_content`: Retrieve full page content
- `search_references`: Find pages referencing specific sections
- `get_related_pages`: Find semantically related pages

## API Endpoints

### TRPC Routes

- `uploadDocument`: Process and store PDF documents
- `queryDocument`: Query documents with natural language
- `getDocuments`: List all uploaded documents

## Example Use Cases

Perfect for:
- Legal documents with complex cross-references
- Technical manuals with section references
- Academic papers with citations
- Regulatory documents with circular references

## Architecture

The system creates an Abstract Syntax Tree-like structure for documents, enabling:
- Semantic understanding without vectors
- Tool-based search and retrieval
- Cross-reference following
- Multi-step reasoning across document sections