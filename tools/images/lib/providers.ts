// Image generation providers. Each one turns a prompt (and optional reference images, used to
// keep the same style everywhere) into a PNG/JPEG buffer.
//
// API keys come from the environment (or a .env file at the project root):
//   OPENAI_API_KEY        (+ optional ZORK_OPENAI_MODEL, default gpt-image-1, and
//                          ZORK_OPENAI_QUALITY, default medium)
//   OPENROUTER_API_KEY    (+ optional ZORK_OPENROUTER_MODEL, default google/gemini-2.5-flash-image)
// Model names and prices change: check the provider's documentation before a big batch.

export interface GenerateRequest {
  prompt: string
  /** Reference images (approved keystones) for style consistency. */
  references: Buffer[]
  /** Wide 16:9 for the scenes, square for the item icons. */
  shape: 'wide' | 'square'
  /** Ask for a transparent background (item icons), or a plain one the post-processing removes. */
  transparent: boolean
}

export interface Provider {
  name: string
  model: string
  /** Rough price of one image in US dollars, for the cost estimate. */
  estimatedCost: Record<GenerateRequest['shape'], number>
  generate(req: GenerateRequest): Promise<Buffer>
}

function env(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing ${name} (set it in the environment or in a .env file at the project root)`)
  return v
}

async function check(res: Response): Promise<Response> {
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const err = new Error(`HTTP ${res.status}: ${body.slice(0, 400)}`) as Error & { status: number }
    err.status = res.status
    throw err
  }
  return res
}

export function openai(): Provider {
  const model = process.env.ZORK_OPENAI_MODEL ?? 'gpt-image-1'
  const quality = process.env.ZORK_OPENAI_QUALITY ?? 'medium'
  return {
    name: 'openai',
    model,
    estimatedCost: { wide: 0.06, square: 0.04 },
    async generate({ prompt, references, shape, transparent }) {
      const key = env('OPENAI_API_KEY')
      const params: Record<string, string> = { model, prompt, size: shape === 'square' ? '1024x1024' : '1536x1024', quality }
      if (transparent) Object.assign(params, { background: 'transparent', output_format: 'png' })
      let res: Response
      if (references.length) {
        // edits endpoint: the reference images guide the style
        const form = new FormData()
        for (const [k, v] of Object.entries(params)) form.append(k, v)
        references.forEach((r, i) => form.append('image[]', new Blob([new Uint8Array(r)], { type: 'image/png' }), `ref-${i}.png`))
        res = await fetch('https://api.openai.com/v1/images/edits', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form })
      } else {
        res = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...params, n: 1 }),
        })
      }
      const json = (await (await check(res)).json()) as { data: { b64_json: string }[] }
      return Buffer.from(json.data[0].b64_json, 'base64')
    },
  }
}

export function openrouter(): Provider {
  const model = process.env.ZORK_OPENROUTER_MODEL ?? 'google/gemini-2.5-flash-image'
  return {
    name: 'openrouter',
    model,
    estimatedCost: { wide: 0.04, square: 0.04 },
    async generate({ prompt, references, shape, transparent }) {
      const key = env('OPENROUTER_API_KEY')
      const framing =
        shape === 'square'
          ? `Square image.${transparent ? ' One single object, centered, on a plain flat solid magenta (#FF00FF) background with nothing else.' : ''}`
          : 'Wide 16:9 landscape image.'
      const content: unknown[] = [{ type: 'text', text: `${prompt}\n\n${framing}${references.length ? ' Match exactly the art style, palette and pixel density of the reference images.' : ''}` }]
      for (const r of references) content.push({ type: 'image_url', image_url: { url: `data:image/png;base64,${r.toString('base64')}` } })
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Zork Next' },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content }],
          modalities: ['image', 'text'],
          image_config: { aspect_ratio: shape === 'square' ? '1:1' : '16:9' },
        }),
      })
      const json = (await (await check(res)).json()) as { choices: { message: { images?: { image_url: { url: string } }[] } }[] }
      const url = json.choices?.[0]?.message?.images?.[0]?.image_url?.url
      if (!url) throw new Error('No image in the response: ' + JSON.stringify(json).slice(0, 400))
      return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64')
    },
  }
}

export const PROVIDERS: Record<string, () => Provider> = { openai, openrouter }
