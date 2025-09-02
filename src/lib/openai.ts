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
  const startTime = Date.now()
  console.log('🤖 Starting AI analysis', { contentLength: content.length })
  
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

  const duration = Date.now() - startTime
  
  // Log the raw response for debugging
  console.log('📋 Raw OpenAI response received', { 
    duration: `${duration}ms`,
    responseLength: result.length,
    preview: result.substring(0, 200) + '...' 
  })

  try {
    // First try to parse as-is
    const parsed = JSON.parse(result)
    console.log('✅ Successfully parsed JSON directly', { 
      summaryLength: parsed.summary?.length || 0,
      tagsCount: parsed.tags?.length || 0,
      referencesCount: parsed.references?.length || 0 
    })
    return parsed
  } catch (initialError) {
    // If that fails, try to extract JSON from markdown code blocks
    console.log('⚠️ Direct JSON parsing failed, attempting markdown extraction')
    
    try {
      const jsonMatch = result.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i)
      if (jsonMatch && jsonMatch[1]) {
        const extractedJson = jsonMatch[1].trim()
        console.log('🔍 Extracted JSON from markdown:', extractedJson.substring(0, 100) + '...')
        const parsed = JSON.parse(extractedJson)
        console.log('✅ Successfully parsed JSON from markdown', { 
          summaryLength: parsed.summary?.length || 0,
          tagsCount: parsed.tags?.length || 0,
          referencesCount: parsed.references?.length || 0 
        })
        return parsed
      }
      
      // Try to find JSON without code blocks (look for { ... })
      const jsonObjectMatch = result.match(/\{[\s\S]*\}/i)
      if (jsonObjectMatch) {
        const extractedJson = jsonObjectMatch[0].trim()
        console.log('🔍 Found JSON object without markdown:', extractedJson.substring(0, 100) + '...')
        const parsed = JSON.parse(extractedJson)
        console.log('✅ Successfully parsed JSON object', { 
          summaryLength: parsed.summary?.length || 0,
          tagsCount: parsed.tags?.length || 0,
          referencesCount: parsed.references?.length || 0 
        })
        return parsed
      }
      
      throw new Error('No JSON found in response')
    } catch (extractionError) {
      console.error('❌ Failed to parse OpenAI response:', {
        initialError: initialError instanceof Error ? initialError.message : String(initialError),
        extractionError: extractionError instanceof Error ? extractionError.message : String(extractionError),
        response: result.substring(0, 500)
      })
      
      // Enhanced fallback parsing
      const lines = result.split('\n').filter(line => line.trim().length > 0)
      
      // Try to extract a meaningful summary from the response
      let summary = 'No summary available'
      let tags: string[] = ['document']
      let references: string[] = []
      
      // Look for content that might be a summary
      for (const line of lines) {
        if (line.includes('summary') || line.includes('Summary')) {
          const summaryMatch = line.match(/[":]\s*(.+)$/i)
          if (summaryMatch && summaryMatch[1] && summaryMatch[1].length > 10) {
            summary = summaryMatch[1].replace(/[",]/g, '').trim()
            break
          }
        }
      }
      
      // If no summary found, use the first substantial line
      if (summary === 'No summary available') {
        const substantialLine = lines.find(line => 
          line.trim().length > 20 && 
          !line.includes('```') && 
          !line.includes('json') &&
          !line.includes('{') &&
          !line.includes('}')
        )
        if (substantialLine) {
          summary = substantialLine.trim().substring(0, 200)
        }
      }
      
      console.log('🔄 Using fallback parsing', { 
        summaryLength: summary.length,
        tagsCount: tags.length,
        referencesCount: references.length,
        summary: summary.substring(0, 100) + '...'
      })
      
      return {
        summary,
        tags,
        references
      }
    }
  }
}

export async function identifyRelevantPages(
  allPages: Array<{ pageNbr: number; content: string; summary: string; tags: string[] }>,
  query: string
): Promise<number[]> {
  const startTime = Date.now()
  console.log('🔍 Starting page relevance analysis', { 
    totalPages: allPages.length, 
    queryLength: query.length,
    query: query.substring(0, 100) + '...' 
  })
  
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

  const duration = Date.now() - startTime
  console.log('📋 Page relevance response received', { 
    duration: `${duration}ms`,
    responseLength: result.length 
  })

  try {
    const parsed = JSON.parse(result)
    const pageNumbers = Array.isArray(parsed) ? parsed : [1, 2, 3]
    console.log('✅ Successfully identified relevant pages', { 
      relevantPages: pageNumbers,
      count: pageNumbers.length 
    })
    return pageNumbers
  } catch (error) {
    console.error('❌ Failed to parse page relevance response:', { 
      error: error instanceof Error ? error.message : String(error),
      response: result.substring(0, 200) + '...'
    })
    console.log('🔄 Using fallback page selection: [1, 2, 3]')
    return [1, 2, 3] // Fallback
  }
}