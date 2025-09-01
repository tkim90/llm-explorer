import OpenAI from 'openai'

let client: OpenAI | null = null

function getClient(): OpenAI {
  if (!client) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required')
    }
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return client
}

export async function generateDocumentSummary(content: string): Promise<{
  summary: string
  tags: string[]
  references: string[]
}> {
  const response = await getClient().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an expert document analyzer. Extract summary, semantic tags, and references from document content. Return only valid JSON.'
      },
      {
        role: 'user',
        content: `Analyze this document page content and return JSON with:
1. summary: A 1-5 sentence summary of the core contents
2. tags: 3-7 semantic topic tags that could help retrieve this page
3. references: Any references to headings, chapters, sections (e.g., "3.1.2", "Sec. 1.100", "§ 9.8")

Content:
${content}

Return only JSON in this format:
{
  "summary": "...",
  "tags": ["tag1", "tag2"],
  "references": ["ref1", "ref2"]
}`
      }
    ],
    temperature: 0.1,
  })

  const result = response.choices[0]?.message.content
  if (!result) {
    throw new Error('No response from OpenAI')
  }

  try {
    return JSON.parse(result)
  } catch {
    // Fallback parsing if JSON is malformed
    return {
      summary: result.split('\n')[0] || 'No summary available',
      tags: ['document'],
      references: []
    }
  }
}

export async function identifyRelevantPages(
  allPages: Array<{ pageNbr: number; content: string; summary: string; tags: string[] }>,
  query: string
): Promise<number[]> {
  const pagesContext = allPages.map(page => 
    `Page ${page.pageNbr}: ${page.summary} (Tags: ${page.tags.join(', ')})`
  ).join('\n')

  const response = await getClient().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are an expert at identifying relevant document pages. Return only a JSON array of page numbers.'
      },
      {
        role: 'user',
        content: `Given this query: "${query}"
    
And these page summaries:
${pagesContext}

Return a JSON array of page numbers that are most relevant for answering this query. Consider:
1. Direct mentions of relevant topics
2. Related concepts that might use different terminology
3. References that might point to other relevant pages

Limit to the top 5-10 most relevant pages.

Return only JSON array: [1, 2, 3, ...]`
      }
    ],
    temperature: 0.1,
  })

  const result = response.choices[0]?.message.content
  if (!result) {
    throw new Error('No response from OpenAI')
  }

  try {
    const parsed = JSON.parse(result)
    return Array.isArray(parsed) ? parsed : [1, 2, 3]
  } catch {
    return [1, 2, 3] // Fallback
  }
}