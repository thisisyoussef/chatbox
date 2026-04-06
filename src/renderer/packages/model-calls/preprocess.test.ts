import { getModel } from '@shared/models'
import { getModelSettings } from '@shared/utils/model_settings'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createModelDependencies } from '@/adapters'
import { settingsStore } from '@/stores/settingsStore'
import { describeImageData } from './preprocess'

vi.mock('@/packages/pic_utils', () => ({
  svgCodeToBase64: vi.fn((svgCode: string) => `data:image/svg+xml;base64,${Buffer.from(svgCode).toString('base64')}`),
  svgToPngBase64: vi.fn(async () => 'data:image/png;base64,cmFzdGVyaXplZC1zdmctcG5n'),
}))

vi.mock('@/adapters', () => ({
  createModelDependencies: vi.fn(async () => ({})),
}))

vi.mock('@shared/models', () => ({
  getModel: vi.fn(),
}))

vi.mock('@shared/utils/model_settings', () => ({
  getModelSettings: vi.fn(() => ({ provider: 'openai', modelId: 'gpt-4.1' })),
}))

vi.mock('@/stores/settingsStore', () => ({
  settingsStore: {
    getState: vi.fn(() => ({
      getSettings: () => ({
        ocrModel: {
          provider: 'openai',
          model: 'gpt-4.1',
        },
      }),
    })),
  },
}))

describe('describeImageData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(createModelDependencies).mockResolvedValue({} as never)
    vi.mocked(getModelSettings).mockReturnValue({ provider: 'openai', modelId: 'gpt-4.1' } as never)
    vi.mocked(settingsStore.getState).mockReturnValue({
      getSettings: () => ({
        ocrModel: {
          provider: 'openai',
          model: 'gpt-4.1',
        },
      }),
    } as never)
  })

  it('rasterizes svg drawing screenshots into png model inputs before description requests', async () => {
    const chat = vi.fn(async () => ({
      contentParts: [
        {
          type: 'text',
          text: 'A moon pizza sketch.',
        },
      ],
    }))

    vi.mocked(getModel).mockReturnValue({
      chat,
    } as never)

    const result = await describeImageData(
      `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"><text>moon pizza</text></svg>')}`
    )

    expect(result).toBe('A moon pizza sketch.')
    expect(chat).toHaveBeenCalledWith(
      [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: expect.stringContaining('Describe this drawing canvas'),
            },
            {
              type: 'image',
              image: 'cmFzdGVyaXplZC1zdmctcG5n',
              mediaType: 'image/png',
              providerOptions: {
                openai: {
                  imageDetail: 'high',
                },
              },
            },
          ],
        },
      ],
      {
        traceContext: undefined,
      }
    )
  })
})
