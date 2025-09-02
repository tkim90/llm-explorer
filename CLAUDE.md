# What is Forager?

Forager is a vectorless RAG implementation. Instead of using vectors and embeddings, it relies on tools like bash, ripgrep, etc.

It's an exploration on whether creating a Abstract Syntax Tree like structure with semantic documents like PDFs can be an alternative to using vector databases.

The core idea is to create metadata of uploaded content and at search time have the Agent search for relevant snippets using tools like grep over the DocumentPage primitive. The DocumentPage primitive metadata about a document page like the semantic topic, any tags, and references (chapters, section numbers, headings).

One common use case are legal documents, which use circular references of semantic concepts.

For example, if the query is "What is the termination policy?". Let's say page 1 metnions Termination Policy. But the actual details of the termination policy are in another page. The passage would have information like "See section 3.4.1 for the termination policy".

Another example is where there are related concepts using different words in different pages. Yet all of those are relevant for answering the question, like "Separation Policy".

In this way we should look at page 1, notice that I have to go to page 35 that references section 3.4.1, and get the context there for answering the question about the Termination Policy.

# DocumentPage

- pageNbr: the page number of the PDF file itself
- pageContentNbr (optional): the page number noted in the page (usually at the bottom) 
- content: the text extracted from the page
- summary: a one to five sentence summary of the core contents of this page.
- tags: semantic topic names that could be helpful for retrieving this page
- references: any references to headings, chapter numbers, section numbers (ex. 3.1.2, Sec. 1.100, § 9.8)

# Core workflow:
1. User uploads a long PDF (100+ pages).
2. Backend pre-processes the file:
  2a. Extract text from every page using PDF parser.
  2b. Store page content a DocumentPage primitive data structure.
3. User enters query "what is the termination policy"
4. Client calls backend with the query
5. Backend uses LLM loop (ai-sdk) with max step count 100 to gather context before answering the question. Here they have access to tools to get as much context as possible. On the first call, AI passes entire DocumentPage content to a single GPT-5 call to determine which pages to focus its search on. In other words, first prompt sends all DocumentPage into the prompt along with the instructions "Return a JSON array of page numbers relevant to the current question". Agent should perform follow up search on each DocumentPage from the returned page number and build up context that might be helpful for answering the question.
6. At each tool call, check if tool was executed, call agent with updated chat history
7. continue until no more tool calls are needed
8. answer the question and send it back to client
9. Client renders the response

# Workspace

- Use `bun` for console commands and package management (bun install, bun run, bun remove, bun test)
- All code must be written in Typescript.
- Runtime: use bunjs
- Frontend: use NextJS 
- Backend: use NextJS api routes
- Uses TRPC to share interface and apis between frontend and backend. 

# Frontend

- Uses shadcn and tailwindcss for styling.
- Only download shadcn as needed. If not used, do not download it.
- Small, composable components.

# Backend

- Built inside NextJS api routes.
- Uses TRPC to expose functions and API contracts to the frontend.
- Uses vercel's ai-sdk client for making LLM calls.
- By default uses OpenAI API.
